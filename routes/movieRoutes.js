const express = require('express');
const router = express.Router();
const SampleMovie = require('../models/SampleMovie');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/apiResponse');
const { asyncErrorHandler } = require('../middleware/errorHandler');

// Enhanced GET /movies with search, filter, and sort
router.get('/', asyncErrorHandler(async (req, res) => {
  const {
    page = 1,
    limit = 12,
    search = '',
    genre = '',
    sortBy = 'title'
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Build search query
  let query = {};
  
  // Search functionality
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { plot: { $regex: search, $options: 'i' } },
      { 'directors.name': { $regex: search, $options: 'i' } },
      { 'cast.name': { $regex: search, $options: 'i' } },
      { directors: { $regex: search, $options: 'i' } }, // For string directors
      { cast: { $in: [new RegExp(search, 'i')] } } // For array cast
    ];
  }
  
  // Genre filter
  if (genre) {
    query.genres = { $in: [genre] };
  }
  
  // Sort options
  let sortOptions = {};
  switch (sortBy) {
    case 'year':
      sortOptions = { year: -1 };
      break;
    case 'rating':
      sortOptions = { 'imdb.rating': -1 };
      break;
    case 'latest':
      sortOptions = { released: -1 };
      break;
    default:
      sortOptions = { title: 1 };
  }
  
  // Execute queries
  const [movies, totalMovies] = await Promise.all([
    SampleMovie.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    SampleMovie.countDocuments(query)
  ]);
  
  const totalPages = Math.ceil(totalMovies / parseInt(limit));
  
  const pagination = {
    currentPage: parseInt(page),
    totalPages,
    totalMovies,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
  
  res.json(paginatedResponse(movies, pagination, 'Movies retrieved successfully'));
}));

// Get movie by ID
router.get('/:id', asyncErrorHandler(async (req, res) => {
  const movie = await SampleMovie.findById(req.params.id);
  
  if (!movie) {
    return res.status(404).json(errorResponse('Movie not found'));
  }
  
  res.json(successResponse('Movie retrieved successfully', movie));
}));

// Get movie statistics
router.get('/stats/overview', asyncErrorHandler(async (req, res) => {
  const [totalMovies, genreStats, yearStats] = await Promise.all([
    SampleMovie.countDocuments(),
    SampleMovie.aggregate([
      { $unwind: '$genres' },
      { $group: { _id: '$genres', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),
    SampleMovie.aggregate([
      { $group: { _id: '$year', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 10 }
    ])
  ]);
  
  const stats = {
    totalMovies,
    topGenres: genreStats,
    moviesByYear: yearStats
  };
  
  res.json(successResponse('Statistics retrieved successfully', stats));
}));

// Search suggestions for autocomplete
router.get('/search/suggestions', asyncErrorHandler(async (req, res) => {
  const { q } = req.query;
  
  if (!q || q.length < 2) {
    return res.json(successResponse('Suggestions retrieved', []));
  }
  
  const suggestions = await SampleMovie.find(
    { title: { $regex: q, $options: 'i' } },
    { title: 1, year: 1 }
  )
  .limit(10)
  .lean();
  
  res.json(successResponse('Suggestions retrieved successfully', suggestions));
}));

module.exports = router;