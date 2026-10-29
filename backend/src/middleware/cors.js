function buildCorsOptions(originList = process.env.CORS_ORIGIN || '', nodeEnv = process.env.NODE_ENV) {
  const allowedOrigins = String(originList).split(',').map((origin) => origin.trim()).filter(Boolean);
  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin || (!allowedOrigins.length && nodeEnv !== 'production') || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
  };
}

module.exports = { buildCorsOptions };
