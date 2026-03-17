export const notFound = (_req, _res, next) =>
  next({ status: 404, message: "Not Found" });

export const errorHandler = (err, _req, res, _next) => {
  const status = err.status || 500;
  // Never leak internal error details in production
  const message =
    process.env.NODE_ENV === "production" && status >= 500
      ? "Internal server error"
      : err.message || "Server error";
  if (process.env.NODE_ENV !== "production") {
    console.error(err);
  }
  res.status(status).json({ success: false, message });
};
