/**
 * Movie Model Schema
 * Defines the structure and validation rules for movie documents in MongoDB
 */

const mongoose = require('mongoose');

/**
 * Movie Schema Definition
 * Defines the structure of movie documents with validation rules
 */
const movieSchema = new mongoose.Schema({
    // Movie title - required field
    title: {
        type: String,
        required: [true, 'Movie title is required'],
        trim: true, // Remove whitespace from both ends
        minlength: [1, 'Title must be at least 1 character long'],
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    
    // Director name - required field
    director: {
        type: String,
        required: [true, 'Director name is required'],
        trim: true,
        minlength: [1, 'Director name must be at least 1 character long'],
        maxlength: [100, 'Director name cannot exceed 100 characters']
    },
    
    // Release year - required field with validation
    year: {
        type: Number,
        required: [true, 'Release year is required'],
        min: [1800, 'Year must be after 1800'],
        max: [new Date().getFullYear() + 5, 'Year cannot be more than 5 years in the future'],
        validate: {
            validator: Number.isInteger,
            message: 'Year must be a valid integer'
        }
    },
    
    // Movie genre - optional field
    genre: {
        type: String,
        trim: true,
        maxlength: [50, 'Genre cannot exceed 50 characters'],
        enum: {
            values: [
                'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 
                'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 
                'Horror', 'Musical', 'Mystery', 'Romance', 'Sci-Fi', 
                'Thriller', 'War', 'Western', 'Other'
            ],
            message: 'Genre must be from the predefined list'
        }
    },
    
    // Movie rating - optional field
    rating: {
        type: Number,
        min: [0, 'Rating cannot be negative'],
        max: [10, 'Rating cannot exceed 10'],
        validate: {
            validator: function(value) {
                // Allow null/undefined or valid numbers with max 1 decimal place
                return value == null || /^\d+(\.\d)?$/.test(value.toString());
            },
            message: 'Rating must be a number with maximum 1 decimal place'
        }
    },
    
    // Movie description - optional field
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    
    // Duration in minutes - optional field
    duration: {
        type: Number,
        min: [1, 'Duration must be at least 1 minute'],
        max: [1000, 'Duration cannot exceed 1000 minutes'],
        validate: {
            validator: Number.isInteger,
            message: 'Duration must be a valid integer (in minutes)'
        }
    },
    
    // Movie poster URL - optional field
    posterUrl: {
        type: String,
        trim: true,
        validate: {
            validator: function(url) {
                // If URL is provided, validate it
                if (!url) return true;
                const urlPattern = /^https?:\/\/.+/;
                return urlPattern.test(url);
            },
            message: 'Poster URL must be a valid HTTP/HTTPS URL'
        }
    }
}, {
    // Schema options
    timestamps: true, // Adds createdAt and updatedAt fields automatically
    versionKey: false, // Disable __v field
    
    // Transform output when converting to JSON
    toJSON: {
        transform: function(doc, ret) {
            // Convert _id to id and remove _id
            ret.id = ret._id;
            delete ret._id;
            
            // Round rating to 1 decimal place if it exists
            if (ret.rating) {
                ret.rating = Math.round(ret.rating * 10) / 10;
            }
            
            return ret;
        }
    }
});

/**
 * Instance Methods
 */

// Method to get movie age
movieSchema.methods.getAge = function() {
    return new Date().getFullYear() - this.year;
};

// Method to get formatted duration
movieSchema.methods.getFormattedDuration = function() {
    if (!this.duration) return 'Unknown';
    const hours = Math.floor(this.duration / 60);
    const minutes = this.duration % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

/**
 * Static Methods
 */

// Find movies by genre
movieSchema.statics.findByGenre = function(genre) {
    return this.find({ genre: new RegExp(genre, 'i') });
};

// Find movies by year range
movieSchema.statics.findByYearRange = function(startYear, endYear) {
    return this.find({
        year: {
            $gte: startYear,
            $lte: endYear
        }
    });
};

// Find movies with high rating
movieSchema.statics.findHighRated = function(minRating = 7) {
    return this.find({ rating: { $gte: minRating } });
};

/**
 * Middleware (Hooks)
 */

// Pre-save middleware - runs before saving a document
movieSchema.pre('save', function(next) {
    // Capitalize first letter of each word in title and director
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
    
    next();
});

// Post-save middleware - runs after saving a document
movieSchema.post('save', function(doc) {
    console.log(`📽️  Movie "${doc.title}" has been saved to database`);
});

/**
 * Indexes for better query performance
 */
movieSchema.index({ title: 1 }); // Single field index on title
movieSchema.index({ director: 1 }); // Single field index on director
movieSchema.index({ year: -1 }); // Descending index on year (newest first)
movieSchema.index({ genre: 1, year: -1 }); // Compound index for genre and year queries
movieSchema.index({ rating: -1 }); // Descending index on rating (highest first)

// Text index for search functionality
movieSchema.index({
    title: 'text',
    director: 'text',
    description: 'text'
}, {
    weights: {
        title: 10,
        director: 5,
        description: 1
    }
});

// Create and export the Movie model
const Movie = mongoose.model('Movie', movieSchema);

module.exports = Movie;