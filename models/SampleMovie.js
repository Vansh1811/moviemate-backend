const mongoose = require('mongoose');

// Enhanced schema for sample_mflix.movies with basic indexing
const sampleMovieSchema = new mongoose.Schema({
  title: { type: String, index: true },
  plot: { type: String, index: 'text' },
  genres: [{ type: String, index: true }],
  year: { type: Number, index: true },
  imdb: {
    rating: { type: Number, index: true },
    votes: Number,
    id: Number
  },
  runtime: Number,
  directors: { type: mongoose.Schema.Types.Mixed, index: 'text' },
  cast: { type: mongoose.Schema.Types.Mixed, index: 'text' },
  poster: String,
  released: { type: Date, index: true },
  awards: String,
  countries: [String],
  languages: [String],
  type: String,
  rated: String,
  metacritic: Number,
  tomatoes: mongoose.Schema.Types.Mixed,
  fullplot: String
}, { 
  strict: false,
  timestamps: false,
  collection: 'movies' // Specify collection name
});

// Create text index for search
sampleMovieSchema.index({
  title: 'text',
  plot: 'text',
  fullplot: 'text'
}, {
  weights: {
    title: 10,
    plot: 5,
    fullplot: 1
  }
});

// Instance method to format movie data for frontend
sampleMovieSchema.methods.toFrontend = function() {
  const movie = this.toObject();
  
  return {
    _id: movie._id,
    title: movie.title || 'Unknown Title',
    plot: movie.plot || movie.fullplot || 'No plot available',
    genres: movie.genres || [],
    year: movie.year,
    rating: movie.imdb?.rating || 0,
    runtime: movie.runtime,
    director: Array.isArray(movie.directors) 
      ? movie.directors.join(', ') 
      : movie.directors || 'Unknown',
    cast: Array.isArray(movie.cast) 
      ? movie.cast.slice(0, 5) 
      : [],
    poster: movie.poster,
    released: movie.released,
    type: movie.type || 'movie'
  };
};

module.exports = mongoose.model('SampleMovie', sampleMovieSchema, 'movies');