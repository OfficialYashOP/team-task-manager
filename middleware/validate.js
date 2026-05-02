/**
 * Generic Joi validation middleware factory
 * Validates request body, query, or params against a Joi schema
 */
function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    req[property] = value;
    next();
  };
}

module.exports = { validate };
