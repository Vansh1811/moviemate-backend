/**
 * Validation Middleware
 * Contains validation logic for request data
 * Validates movie data before processing
 */

const { body, validationResult } = require('express-validator');

/**
 * Handle validation errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(error => ({
                field: error.path,
                message: error.msg,
                value: error.value
            }))
        });
    }
    next();
};

/**
 * Validation rules for creating a new movie
 */
const validateMovie = [
    // Title validation
    body('title')
        .notEmpty()
        .withMessage('Title is required')
        .isLength({ min: 1, max: 200 })
        .withMessage('Title must be between 1 and 200 characters')
        .trim()
        .escape(), // Sanitize HTML entities

    // Director validation
    body('director')
        .notEmpty()
        .withMessage('Director is required')
        .isLength({ min: 1, max: 100 })
        .withMessage('Director name must be between 1 and 100 characters')
        .trim()
        .escape(),

    // Year validation
    body('year')
        .notEmpty()
        .withMessage('Year is required')
        .isInt({ min: 1800, max: new Date().getFullYear() + 5 })
        .withMessage(`Year must be between 1800 and ${new Date().getFullYear() + 5}`)
        .toInt(),

    // Genre validation (optional)
    body('genre')
        .optional()
        .isIn([
            'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 
            'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 
            'Horror', 'Musical', 'Mystery', 'Romance', 'Sci-Fi', 
            'Thriller', 'War', 'Western', 'Other'
        ])
        .withMessage('Genre must be from the predefined list')
        .trim(),

    // Rating validation (optional)
    body('rating')
        .optional()
        .isFloat({ min: 0, max: 10 })
        .withMessage('Rating must be between 0 and 10')
        .custom((value) => {
            // Check if rating has more than 1 decimal place
            if (value && value.toString().split('.')[1]?.length > 1) {
                throw new Error('Rating can have maximum 1 decimal place');
            }
            return true;
        })
        .toFloat(),

    // Description validation (optional)
    body('description')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Description cannot exceed 1000 characters')
        .trim(),

    // Duration validation (optional)
    body('duration')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Duration must be between 1 and 1000 minutes')
        .toInt(),

    // Poster URL validation (optional)
    body('posterUrl')
        .optional()
        .isURL({
            protocols: ['http', 'https'],
            require_protocol: true
        })
        .withMessage('Poster URL must be a valid HTTP/HTTPS URL')
        .trim(),

    // Handle validation errors
    handleValidationErrors
];

/**
 * Validation rules for updating a movie
 * Similar to create validation but all fields are optional
 */
const validateMovieUpdate = [
    // Title validation (optional)
    body('title')
        .optional()
        .notEmpty()
        .withMessage('Title cannot be empty if provided')
        .isLength({ min: 1, max: 200 })
        .withMessage('Title must be between 1 and 200 characters')
        .trim()
        .escape(),

    // Director validation (optional)
    body('director')
        .optional()
        .notEmpty()
        .withMessage('Director cannot be empty if provided')
        .isLength({ min: 1, max: 100 })
        .withMessage('Director name must be between 1 and 100 characters')
        .trim()
        .escape(),

    // Year validation (optional)
    body('year')
        .optional()
        .isInt({ min: 1800, max: new Date().getFullYear() + 5 })
        .withMessage(`Year must be between 1800 and ${new Date().getFullYear() + 5}`)
        .toInt(),

    // Genre validation (optional)
    body('genre')
        .optional()
        .isIn([
            'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 
            'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 
            'Horror', 'Musical', 'Mystery', 'Romance', 'Sci-Fi', 
            'Thriller', 'War', 'Western', 'Other'
        ])
        .withMessage('Genre must be from the predefined list')
        .trim(),

    // Rating validation (optional)
    body('rating')
        .optional()
        .isFloat({ min: 0, max: 10 })
        .withMessage('Rating must be between 0 and 10')
        .custom((value) => {
            if (value && value.toString().split('.')[1]?.length > 1) {
                throw new Error('Rating can have maximum 1 decimal place');
            }
            return true;
        })
        .toFloat(),

    // Description validation (optional)
    body('description')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Description cannot exceed 1000 characters')
        .trim(),

    // Duration validation (optional)
    body('duration')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Duration must be between 1 and 1000 minutes')
        .toInt(),

    // Poster URL validation (optional)
    body('posterUrl')
        .optional()
        .isURL({
            protocols: ['http', 'https'],
            require_protocol: true
        })
        .withMessage('Poster URL must be a valid HTTP/HTTPS URL')
        .trim(),

    // Custom validation to ensure at least one field is provided for update
    body()
        .custom((value, { req }) => {
            const allowedFields = ['title', 'director', 'year', 'genre', 'rating', 'description', 'duration', 'posterUrl'];
            const providedFields = Object.keys(req.body);
            const validFields = providedFields.filter(field => allowedFields.includes(field));
            
            if (validFields.length === 0) {
                throw new Error('At least one field must be provided for update');
            }
            return true;
        }),

    // Handle validation errors
    handleValidationErrors
];

/**
 * Validation for query parameters
 */
const validateQueryParams = [
    // Page validation
    body('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer')
        .toInt(),

    // Limit validation
    body('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
        .toInt(),

    // Year filter validation
    body('year')
        .optional()
        .isInt({ min: 1800, max: new Date().getFullYear() + 5 })
        .withMessage('Year must be a valid year')
        .toInt(),

    // Minimum rating validation
    body('minRating')
        .optional()
        .isFloat({ min: 0, max: 10 })
        .withMessage('Minimum rating must be between 0 and 10')
        .toFloat(),

    // Handle validation errors
    handleValidationErrors
];

// Export validation middleware
module.exports = {
    validateMovie,
    validateMovieUpdate,
    validateQueryParams,
    handleValidationErrors
};