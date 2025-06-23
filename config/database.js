/**
 * Enhanced Movie Model Schema
 * Supports both sample data and custom movies with advanced features
 */

const mongoose = require('mongoose');

/**
 * Enhanced Movie Schema with comprehensive fields
 */
const movieSchema = new mongoose.Schema({
    // Basic movie information
    title: {
        type: String,
        required: [true, 'Movie title is required'],
        trim: true,
        minlength: [1, 'Title must be at least 1 character long'],
        maxlength: [200, 'Title cannot exceed 200 characters'],
        index: true
    },
    
    // Plot/Description
    plot: {
        type: String,
        trim: true,
        maxlength: [2000, 'Plot cannot exceed 2000 characters']
    },
    
    // Genres array to support multiple genres
    genres: [{
        type: String,
        trim: true,
        enum: [
            'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 
            'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 
            'History', 'Horror', 'Music', 'Musical', 'Mystery', 
            'Romance', 'Sci-Fi', 'Sport', 'Thriller', 'War', 'Western'
        ]
    }],
    
    // Release year
    year: {
        type: Number,
        min: [1800, 'Year must be after 1800'],
        max: [new Date().getFullYear() + 5, 'Year cannot be more than 5 years in the future'],
        index: true
    },
    
    // Runtime in minutes
    runtime: {
        type: Number,
        min: [1, 'Runtime must be at least 1 minute'],
        max: [1000, 'Runtime cannot exceed 1000 minutes']
    },
    
    // Director information
    director: {
        type: String,
        trim: true,
        maxlength: [100, 'Director name cannot exceed 100 characters']
    },
    
    // Cast array
    cast: [{
        type: String,
        trim: true,
        maxlength: [100, 'Actor name cannot exceed 100 characters']
    }],
    
    // IMDB information
    imdb: {
        rating: {
            type: Number,
            min: [0, 'IMDB rating cannot be negative'],
            max: [10, 'IMDB rating cannot exceed 10']
        },
        votes: {
            type: Number,
            min: [0, 'IMDB votes cannot be negative']
        },
        id: {
            type: String,
            trim: true
        }
    },
    
    // Poster URL
    poster: {
        type: String,
        trim: true,
        validate: {
            validator: function(url) {
                if (!url) return true;
                return /^https?:\/\/.+/i.test(url);
            },
            message: 'Poster must be a valid URL'
        }
    },
    
    // Release date
    released: {
        type: Date
    },
    
    // Additional metadata
    rated: {
        type: String,
        enum: ['G', 'PG', 'PG-13', 'R', 'NC-17', 'Not Rated', 'Unrated'],
        trim: true
    },
    
    // Country of origin
    countries: [{
        type: String,
        trim: true
    }],
    
    // Languages
    languages: [{
        type: String,
        trim: true
    }],
    
    // Awards
    awards: {
        text: String,
        wins: Number,
        nominations: Number
    },
    
    // Metacritic score
    metacritic: {
        type: Number,
        min: [0, 'Metacritic score cannot be negative'],
        max: [100, 'Metacritic score cannot exceed 100']
    },
    
    // Box office information
    boxOffice: {
        budget: Number,
        gross: Number,
        opening: Number
    },
    
    // Tomatoes (Rotten Tomatoes)
    tomatoes: {
        viewer: {
            rating: Number,
            numReviews: Number,
            meter: Number
        },
        critic: {
            rating: Number,
            numReviews: Number,
            meter: Number
        },
        fresh: Number,
        rotten: Number
    },
    
    // User engagement metrics
    favorites: {
        type: Number,
        default: 0,
        min: [0, 'Favorites cannot be negative']
    },
    
    watchlistCount: {
        type: Number,
        default: 0,
        min: [0, 'Watchlist count cannot be negative']
    },
    
    viewCount: {
        type: Number,
        default: 0,
        min: [0, 'View count cannot be negative']
    },
    
    // Source tracking
    source: {
        type: String,
        enum: ['mflix', 'omdb', 'tmdb', 'user', 'admin'],
        default: 'user'
    },
    
    // Status
    status: {
        type: String,
        enum: ['active', 'inactive', 'pending', 'deleted'],
        default: 'active'
    }
}, {
    timestamps: true,
    versionKey: false,
    toJSON: {
        transform: function(doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            
            // Round ratings to 1 decimal place
            if (ret.imdb?.rating) {
                ret.imdb.rating = Math.round(ret.imdb.rating * 10) / 10;
            }
            if (ret.tomatoes?.viewer?.rating) {
                ret.tomatoes.viewer.rating = Math.round(ret.tomatoes.viewer.rating * 10) / 10;
            }
            if (ret.tomatoes?.critic?.rating) {
                ret.tomatoes.critic.rating = Math.round(ret.tomatoes.critic.rating * 10) / 10;
            }
            
            return ret;
        }
    }
});

/**
 * Instance Methods
 */
movieSchema.methods.getAge = function() {
    return new Date().getFullYear() - this.year;
};

movieSchema.methods.getFormattedRuntime = function() {
    if (!this.runtime) return 'Unknown';
    const hours = Math.floor(this.runtime / 60);
    const minutes = this.runtime % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

movieSchema.methods.incrementView = function() {
    this.viewCount = (this.viewCount || 0) + 1;
    return this.save();
};

movieSchema.methods.addToFavorites = function() {
    this.favorites = (this.favorites || 0) + 1;
    return this.save();
};

movieSchema.methods.removeFromFavorites = function() {
    this.favorites = Math.max((this.favorites || 0) - 1, 0);
    return this.save();
};

/**
 * Static Methods
 */
movieSchema.statics.findByGenre = function(genre) {
    return this.find({ genres: { $in: [new RegExp(genre, 'i')] } });
};

movieSchema.statics.findByYearRange = function(startYear, endYear) {
    return this.find({
        year: { $gte: startYear, $lte: endYear }
    });
};

movieSchema.statics.findHighRated = function(minRating = 7) {
    return this.find({ 'imdb.rating': { $gte: minRating } });
};

movieSchema.statics.getPopular = function(limit = 10) {
    return this.find({ status: 'active' })
        .sort({ viewCount: -1, 'imdb.rating': -1 })
        .limit(limit);
};

movieSchema.statics.getRecentlyAdded = function(limit = 10) {
    return this.find({ status: 'active' })
        .sort({ createdAt: -1 })
        .limit(limit);
};

movieSchema.statics.searchMovies = function(query, options = {}) {
    const {
        page = 1,
        limit = 12,
        sortBy = 'title',
        genre,
        year,
        minRating,
        maxRating,
        decade
    } = options;

    const skip = (page - 1) * limit;
    let searchQuery = { status: 'active' };
    
    // Text search
    if (query) {
        searchQuery.$or = [
            { title: { $regex: query, $options: 'i' } },
            { plot: { $regex: query, $options: 'i' } },
            { director: { $regex: query, $options: 'i' } },
            { cast: { $in: [new RegExp(query, 'i')] } }
        ];
    }
    
    // Genre filter
    if (genre) {
        searchQuery.genres = { $in: [new RegExp(genre, 'i')] };
    }
    
    // Year filter
    if (year) {
        searchQuery.year = parseInt(year);
    }
    
    // Decade filter
    if (decade) {
        const decadeStart = parseInt(decade);
        const decadeEnd = decadeStart + 9;
        searchQuery.year = { $gte: decadeStart, $lte: decadeEnd };
    }
    
    // Rating filter
    if (minRating || maxRating) {
        searchQuery['imdb.rating'] = {};
        if (minRating) searchQuery['imdb.rating'].$gte = parseFloat(minRating);
        if (maxRating) searchQuery['imdb.rating'].$lte = parseFloat(maxRating);
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
        case 'popularity':
            sortOptions = { viewCount: -1, favorites: -1 };
            break;
        case 'latest':
            sortOptions = { createdAt: -1 };
            break;
        case 'runtime':
            sortOptions = { runtime: -1 };
            break;
        default:
            sortOptions = { title: 1 };
    }
    
    return this.find(searchQuery)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);
};

/**
 * Middleware
 */
movieSchema.pre('save', function(next) {
    // Auto-capitalize title and director
    if (this.title) {
        this.title = this.title.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    }
    
    if (this.director) {
        this.director = this.director.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    }
    
    // Set release date from year if not provided
    if (this.year && !this.released) {
        this.released = new Date(this.year, 0, 1);
    }
    
    next();
});

/**
 * Indexes for optimal performance
 */
movieSchema.index({ title: 1 });
movieSchema.index({ director: 1 });
movieSchema.index({ year: -1 });
movieSchema.index({ genres: 1 });
movieSchema.index({ 'imdb.rating': -1 });
movieSchema.index({ createdAt: -1 });
movieSchema.index({ viewCount: -1 });
movieSchema.index({ favorites: -1 });
movieSchema.index({ status: 1 });

// Compound indexes for common queries
movieSchema.index({ genres: 1, year: -1 });
movieSchema.index({ 'imdb.rating': -1, year: -1 });
movieSchema.index({ status: 1, createdAt: -1 });

// Text search index
movieSchema.index({
    title: 'text',
    plot: 'text',
    director: 'text',
    cast: 'text'
}, {
    weights: {
        title: 10,
        director: 5,
        plot: 3,
        cast: 2
    },
    name: 'movie_text_index'
});

const Movie = mongoose.model('Movie', movieSchema);

module.exports = Movie;