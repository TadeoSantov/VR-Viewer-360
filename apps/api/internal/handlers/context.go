package handlers

// ctxKeyUserID is the context key used to pass the authenticated user's ID between middleware and handlers.
type contextKey string

const ctxKeyUserID contextKey = "userID"
