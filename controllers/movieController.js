/**
 * Enhanced Movie Controller
 * Comprehensive movie management with advanced features
 */

const Movie = require('../models/Movie');
const SampleMovie = require('../models/SampleMovie');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/apiResponse');
const { asyncErrorHandler } = require('../middleware/errorHandler');

/**
 * @desc    Get all movies with advanced filtering, sorting, and search
 * @route   GET /api/movies
 * @access  Public
 */
const getAllMovies = asyncErrorHandler(async (req, res) => {
    const {
        page = 1,
        limit = 12,
        search = '',
        genre = '',
        year = '',
        decade = '',
        minRating = '',
        maxRating = '',
        sortBy = 'title',
        source = ''
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build search query
    let query = { status: 'active' };
    
    // Search functionality
    if (search.trim()) {
        query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { plot: { $regex: search, $options: 'i' } },
            { director: { $regex: search, $options: 'i' } },
            { cast: { $elemMatch: { $regex: search, $options: 'i' } } },
            { genres: { $elemMatch: { $regex: search, $options: 'i' } } }
        ];
    }
    
    // Genre filter
    if (genre) {
        query.genres = { $in: [new RegExp(genre, 'i')] };
    }
    
    // Year filter
    if (year) {
        query.year = parseInt(year);
    }
    
    // Decade filter
    if (decade) {
        const decadeStart = parseInt(decade);
        const decadeEnd = decadeStart + 9;
        query.year = { $gte: decadeStart, $lte: decadeEnd };
    }
    
    // Rating filter
    if (minRating || maxRating) {
        query['imdb.rating'] = {};
        if (minRating) query['imdb.rating'].$gte = parseFloat(minRating);
        if (maxRating) query['imdb.rating'].$lte = parseFloat(maxRating);
    }
    
    // Source filter
    if (source) {
        query.source = source;
    }
    
    // Sort options
    let sortOptions = {};
    switch (sortBy) {
        case 'year':
            sortOptions = { year: -1, title: 1 };
            break;
        case 'rating':
            sortOptions = { 'imdb.rating': -1, 'imdb.votes': -1, title: 1 };
            break;
        case 'popularity':
            sortOptions = { viewCount: -1, favorites: -1, title: 1 };
            break;
        case 'latest':
            sortOptions = { createdAt: -1 };
            break;
        case 'runtime':
            sortOptions = { runtime: -1, title: 1 };
            break;
        case 'alphabetical':
            sortOptions = { title: 1 };
            break;
        default:
            sortOptions = { title: 1 };
    }
    
    // Execute queries in parallel for better performance
    const [movies, totalMovies, genres, yearStats] = await Promise.all([
        Movie.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Movie.countDocuments(query),
        // Get available genres for filtering
        Movie.distinct('genres', { status: 'active' }),
        // Get year range statistics
        Movie.aggregate([
            { $match: { status: 'active' } },
            {
                $group: {
                    _id: null,
                    minYear: { $min: '$year' },
                    maxYear: { $max: '$year' }
                }
            }
        ])
    ]);
    
    const totalPages = Math.ceil(totalMovies / limitNum);
    
    const pagination = {
        currentPage: pageNum,
        totalPages,
        totalMovies,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
        limit: limitNum
    };
    
    const metadata = {
        filters: {
            availableGenres: genres.sort(),
            yearRange: yearStats[0] || { minYear: null, maxYear: null }
        },
        searchQuery: search,
        appliedFilters: {
            genre: genre || null,
            year: year || null,
            decade: decade || null,
            minRating: minRating || null,
            maxRating: maxRating || null,
            sortBy
        }
    };

    res.json(successResponse('Movies retrieved successfully', {
        movies,
        pagination,
        metadata
    }));
});

/**
 * @desc    Get single movie by ID
 * @route   GET /api/movies/:id
 * @access  Public
 */
const getMovieById = asyncErrorHandler(async (req, res) => {
    const { id } = req.params;
    
    const movie = await Movie.findById(id);
    
    if (!movie || movie.status === 'deleted') {
        return res.status(404).json(errorResponse(
            'Movie not found',
            `No movie found with ID: ${id}`
        ));
    }
    
    // Increment view count asynchronously
    movie.incrementView().catch(err => 
        console.error('Failed to increment view count:', err)
    );
    
    // Get related movies (same genre or director)
    const relatedMovies = await Movie.find({
        _id: { $ne: id },
        status: 'active',
        $or: [
            { genres: { $in: movie.genres } },
            { director: movie.director }
        ]
    })
    .limit(6)
    .select('title year poster imdb.rating genres')
    .lean();

    res.json(successResponse('Movie retrieved successfully', {
        movie,
        relatedMovies
    }));
});

/**
 * @desc    Create a new movie
 * @route   POST /api/movies
 * @access  Public
 */
const createMovie = asyncErrorHandler(async (req, res) => {
    const movieData = { ...req.body, source: 'user' };
    
    // Check for duplicate
    const existingMovie = await Movie.findOne({
        title: new RegExp(`^${movieData.title}$`, 'i'),
        year: movieData.year,
        status: { $ne: 'deleted' }
    });
    
    if (existingMovie) {
        return res.status(409).json(errorResponse(
            'Duplicate movie',
            `A movie with title "${movieData.title}" and year ${movieData.year} already exists`
        ));
    }
    
    const movie = new Movie(movieData);
    const savedMovie = await movie.save();
    
    res.status(201).json(successResponse(
        'Movie created successfully',
        savedMovie
    ));
});

/**
 * @desc    Update movie by ID
 * @route   PUT /api/movies/:id
 * @access  Public
 */
const updateMovie = asyncErrorHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    
    // Check for duplicates if title or year is being updated
    if (updateData.title || updateData.year) {
        const existingMovie = await Movie.findOne({
            _id: { $ne: id },
            title: new RegExp(`^${updateData.title || '.*'}$`, 'i'),
            year: updateData.year,
            status: { $ne: 'deleted' }
        });
        
        if (existingMovie) {
            return res.status(409).json(errorResponse(
                'Duplicate movie',
                `A movie with title "${updateData.title}" and year ${updateData.year} already exists`
            ));
        }
    }
    
    const movie = await Movie.findByIdAndUpdate(
        id,
        { ...updateData, updatedAt: new Date() },
        { new: true, runValidators: true }
    );
    
    if (!movie || movie.status === 'deleted') {
        return res.status(404).json(errorResponse(
            'Movie not found',
            `No movie found with ID: ${id}`
        ));
    }
    
    res.json(successResponse('Movie updated successfully', movie));
});

/**
 * @desc    Delete movie by ID (soft delete)
 * @route   DELETE /api/movies/:id
 * @access  Public
 */
const deleteMovie = asyncErrorHandler(async (req, res) => {
    const { id } = req.params;
    
    const movie = await Movie.findByIdAndUpdate(
        id,
        { status: 'deleted', deletedAt: new Date() },
        { new: true }
    );
    
    if (!movie) {
        return res.status(404).json(errorResponse(
            'Movie not found',
            `No movie found with ID: ${id}`
        ));
    }
    
    res.json(successResponse('Movie deleted successfully', {
        deletedMovie: {
            id: movie._id,
            title: movie.title,
            year: movie.year
        }
    }));
});

/**
 * @desc    Get movie statistics and analytics
 * @route   GET /api/movies/stats
 * @access  Public
 */
const getMovieStats = asyncErrorHandler(async (req, res) => {
    const [
        overview,
        genreStats,
        yearStats,
        ratingStats,
        topRated,
        mostPopular,
        recentlyAdded
    ] = await Promise.all([
        // Overview statistics
        Movie.aggregate([
            { $match: { status: 'active' } },
            {
                $group: {
                    _id: null,
                    totalMovies: { $sum: 1 },
                    averageRating: { $avg: '$imdb.rating' },
                    averageRuntime: { $avg: '$runtime' },
                    totalViews: { $sum: '$viewCount' },
                    totalFavorites: { $sum: '$favorites' },
                    oldestYear: { $min: '$year' },
                    newestYear: { $max: '$year' }
                }
            }
        ]),
        
        // Genre distribution
        Movie.aggregate([
            { $match: { status: 'active' } },
            { $unwind: '$genres' },
            {
                $group: {
                    _id: '$genres',
                    count: { $sum: 1 },
                    averageRating: { $avg: '$imdb.rating' }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]),
        
        // Movies by year/decade
        Movie.aggregate([
            { $match: { status: 'active', year: { $exists: true } } },
            {
                $group: {
                    _id: { $subtract: ['$year', { $mod: ['$year', 10] }] },
                    count: { $sum: 1 },
                    averageRating: { $avg: '$imdb.rating' }
                }
            },
            { $sort: { _id: -1 } },
            { $limit: 10 }
        ]),
        
        // Rating distribution
        Movie.aggregate([
            { $match: { status: 'active', 'imdb.rating': { $exists: true } } },
            {
                $bucket: {
                    groupBy: '$imdb.rating',
                    boundaries: [0, 2, 4, 6, 7, 8, 9, 10],
                    default: 'Other',
                    output: {
                        count: { $sum: 1 },
                        titles: { $push: '$title' }
                    }
                }
            }
        ]),
        
        // Top rated movies
        Movie.find({
            status: 'active',
            'imdb.rating': { $gte: 7 }
        })
        .sort({ 'imdb.rating': -1, 'imdb.votes': -1 })
        .limit(10)
        .select('title director year imdb.rating poster')
        .lean(),
        
        // Most popular movies
        Movie.find({ status: 'active' })
        .sort({ viewCount: -1, favorites: -1 })
        .limit(10)
        .select('title director year viewCount favorites poster')
        .lean(),
        
        // Recently added movies
        Movie.find({ status: 'active' })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('title director year createdAt poster')
        .lean()
    ]);
    
    const stats = {
        overview: overview[0] || {
            totalMovies: 0,
            averageRating: 0,
            averageRuntime: 0,
            totalViews: 0,
            totalFavorites: 0,
            oldestYear: null,
            newestYear: null
        },
        genreDistribution: genreStats,
        yearDistribution: yearStats.map(item => ({
            decade: `${item._id}s`,
            count: item.count,
            averageRating: Math.round((item.averageRating || 0) * 10) / 10
        })),
        ratingDistribution: ratingStats,
        topRated,
        mostPopular,
        recentlyAdded
    };
    
    res.json(successResponse('Movie statistics retrieved successfully', stats));
});

/**
 * @desc    Search movie titles for autocomplete
 * @route   GET /api/movies/search/suggestions
 * @access  Public
 */
const getSearchSuggestions = asyncErrorHandler(async (req, res) => {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
        return res.json(successResponse('Search suggestions', []));
    }
    
    const suggestions = await Movie.find({
        status: 'active',
        title: { $regex: q, $options: 'i' }
    })
    .select('title year director')
    .sort({ viewCount: -1, title: 1 })
    .limit(10)
    .lean();
    
    const formattedSuggestions = suggestions.map(movie => ({
        id: movie._id,
        title: movie.title,
        year: movie.year,
        director: movie.director,
        display: `${movie.title} (${movie.year})`
    }));
    
    res.json(successResponse('Search suggestions retrieved', formattedSuggestions));
});

/**
 * @desc    Add movie to favorites
 * @route   POST /api/movies/:id/favorite
 * @access  Public
 */
const addToFavorites = asyncErrorHandler(async (req, res) => {
    const { id } = req.params;
    
    const movie = await Movie.findById(id);
    
    if (!movie || movie.status === 'deleted') {
        return res.status(404).json(errorResponse(
            'Movie not found',
            `No movie found with ID: ${id}`
        ));
    }
    
    await movie.addToFavorites();
    
    res.json(successResponse('Movie added to favorites', {
        movieId: id,
        favorites: movie.favorites
    }));
});

/**
 * @desc    Remove movie from favorites
 * @route   DELETE /api/movies/:id/favorite
 * @access  Public
 */
const removeFromFavorites = asyncErrorHandler(async (req, res) => {
    const { id } = req.params;
    
    const movie = await Movie.findById(id);
    
    if (!movie || movie.status === 'deleted') {
        return res.status(404).json(errorResponse(
            'Movie not found',
            `No movie found with ID: ${id}`
        ));
    }
    
    await movie.removeFromFavorites();
    
    res.json(successResponse('Movie removed from favorites', {
        movieId: id,
        favorites: movie.favorites
    }));
});

/**
 * @desc    Get trending movies
 * @route   GET /api/movies/trending
 * @access  Public
 */
const getTrendingMovies = asyncErrorHandler(async (req, res) => {
    const { period = 'week', limit = 10 } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
        case 'day':
            dateFilter = {
                updatedAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
            };
            break;
        case 'week':
            dateFilter = {
                updatedAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
            };
            break;
        case 'month':
            dateFilter = {
                updatedAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }
            };
            break;
        default:
            break;
    }
    
    const trendingMovies = await Movie.find({
        status: 'active',
        ...dateFilter
    })
    .sort({ viewCount: -1, favorites: -1, 'imdb.rating': -1 })
    .limit(parseInt(limit))
    .select('title director year poster imdb.rating viewCount favorites genres')
    .lean();
    
    res.json(successResponse('Trending movies retrieved successfully', {
        movies: trendingMovies,
        period,
        count: trendingMovies.length
    }));
});

/**
 * @desc    Get movies by genre
 * @route   GET /api/movies/genre/:genre
 * @access  Public
 */
const getMoviesByGenre = asyncErrorHandler(async (req, res) => {
    const { genre } = req.params;
    const { page = 1, limit = 12, sortBy = 'rating' } = req.query;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    let sortOptions = {};
    switch (sortBy) {
        case 'year':
            sortOptions = { year: -1, title: 1 };
            break;
        case 'rating':
            sortOptions = { 'imdb.rating': -1, 'imdb.votes': -1 };
            break;
        case 'popularity':
            sortOptions = { viewCount: -1, favorites: -1 };
            break;
        case 'alphabetical':
            sortOptions = { title: 1 };
            break;
        default:
            sortOptions = { 'imdb.rating': -1, 'imdb.votes': -1 };
    }
    
    const query = {
        status: 'active',
        genres: { $regex: new RegExp(genre, 'i') }
    };
    
    const [movies, totalMovies] = await Promise.all([
        Movie.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Movie.countDocuments(query)
    ]);
    
    const totalPages = Math.ceil(totalMovies / limitNum);
    
    const pagination = {
        currentPage: pageNum,
        totalPages,
        totalMovies,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
        limit: limitNum
    };
    
    res.json(successResponse(`Movies in ${genre} genre retrieved successfully`, {
        movies,
        pagination,
        genre,
        sortBy
    }));
});

/**
 * @desc    Bulk import movies from sample data
 * @route   POST /api/movies/bulk-import
 * @access  Public
 */
const bulkImportMovies = asyncErrorHandler(async (req, res) => {
    const { source = 'sample', overwrite = false } = req.body;
    
    let importData = [];
    
    if (source === 'sample') {
        importData = await SampleMovie.find({}).lean();
    } else if (req.body.movies && Array.isArray(req.body.movies)) {
        importData = req.body.movies;
    } else {
        return res.status(400).json(errorResponse(
            'Invalid import data',
            'Please provide either source="sample" or an array of movies'
        ));
    }
    
    if (importData.length === 0) {
        return res.status(400).json(errorResponse(
            'No data to import',
            'Import data is empty'
        ));
    }
    
    const results = {
        imported: 0,
        skipped: 0,
        errors: 0,
        errorDetails: []
    };
    
    for (const movieData of importData) {
        try {
            const existingMovie = await Movie.findOne({
                title: new RegExp(`^${movieData.title}$`, 'i'),
                year: movieData.year,
                status: { $ne: 'deleted' }
            });
            
            if (existingMovie && !overwrite) {
                results.skipped++;
                continue;
            }
            
            if (existingMovie && overwrite) {
                await Movie.findByIdAndUpdate(existingMovie._id, {
                    ...movieData,
                    source: source,
                    updatedAt: new Date()
                });
            } else {
                const movie = new Movie({
                    ...movieData,
                    source: source,
                    status: 'active'
                });
                await movie.save();
            }
            
            results.imported++;
        } catch (error) {
            results.errors++;
            results.errorDetails.push({
                title: movieData.title,
                error: error.message
            });
        }
    }
    
    res.json(successResponse('Bulk import completed', results));
});

/**
 * @desc    Export movies data
 * @route   GET /api/movies/export
 * @access  Public
 */
const exportMovies = asyncErrorHandler(async (req, res) => {
    const { format = 'json', includeDeleted = false } = req.query;
    
    const query = includeDeleted === 'true' ? {} : { status: 'active' };
    
    const movies = await Movie.find(query)
        .select('-__v')
        .sort({ title: 1 })
        .lean();
    
    if (format === 'csv') {
        // Convert to CSV format
        const csvHeaders = [
            'title', 'director', 'year', 'runtime', 'plot',
            'genres', 'cast', 'imdb_rating', 'imdb_votes',
            'poster', 'viewCount', 'favorites', 'source', 'status'
        ];
        
        const csvRows = movies.map(movie => [
            movie.title || '',
            movie.director || '',
            movie.year || '',
            movie.runtime || '',
            movie.plot || '',
            Array.isArray(movie.genres) ? movie.genres.join(';') : '',
            Array.isArray(movie.cast) ? movie.cast.join(';') : '',
            movie.imdb?.rating || '',
            movie.imdb?.votes || '',
            movie.poster || '',
            movie.viewCount || 0,
            movie.favorites || 0,
            movie.source || '',
            movie.status || ''
        ]);
        
        const csvContent = [csvHeaders, ...csvRows]
            .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=movies_export.csv');
        return res.send(csvContent);
    }
    
    res.json(successResponse('Movies exported successfully', {
        movies,
        count: movies.length,
        exportDate: new Date().toISOString()
    }));
});

/**
 * @desc    Get random movies
 * @route   GET /api/movies/random
 * @access  Public
 */
const getRandomMovies = asyncErrorHandler(async (req, res) => {
    const { 
        count = 5, 
        genre = '', 
        minRating = '', 
        maxYear = '',
        minYear = ''
    } = req.query;
    
    const limit = Math.min(20, Math.max(1, parseInt(count)));
    
    let matchQuery = { status: 'active' };
    
    if (genre) {
        matchQuery.genres = { $regex: new RegExp(genre, 'i') };
    }
    
    if (minRating) {
        matchQuery['imdb.rating'] = { $gte: parseFloat(minRating) };
    }
    
    if (minYear || maxYear) {
        matchQuery.year = {};
        if (minYear) matchQuery.year.$gte = parseInt(minYear);
        if (maxYear) matchQuery.year.$lte = parseInt(maxYear);
    }
    
    const randomMovies = await Movie.aggregate([
        { $match: matchQuery },
        { $sample: { size: limit } },
        {
            $project: {
                title: 1,
                director: 1,
                year: 1,
                runtime: 1,
                genres: 1,
                poster: 1,
                'imdb.rating': 1,
                plot: 1
            }
        }
    ]);
    
    res.json(successResponse('Random movies retrieved successfully', {
        movies: randomMovies,
        count: randomMovies.length,
        filters: {
            genre: genre || null,
            minRating: minRating || null,
            minYear: minYear || null,
            maxYear: maxYear || null
        }
    }));
});

// Export all controller functions
module.exports = {
    getAllMovies,
    getMovieById,
    createMovie,
    updateMovie,
    deleteMovie,
    getMovieStats,
    getSearchSuggestions,
    addToFavorites,
    removeFromFavorites,
    getTrendingMovies,
    getMoviesByGenre,
    bulkImportMovies,
    exportMovies,
    getRandomMovies
};