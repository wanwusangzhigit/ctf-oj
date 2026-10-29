package response

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/domain"
)

type Body struct {
	Code    int         `json:"code"`
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message"`
}

func OK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Body{Code: 0, Data: data, Message: "ok"})
}

func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, Body{Code: 0, Data: data, Message: "created"})
}

func NoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

func Err(c *gin.Context, err error) {
	status, code, msg := classify(err)
	c.JSON(status, Body{Code: code, Message: msg})
}

type Pager[T any] struct {
	Items    []T   `json:"items"`
	Total    int64 `json:"total"`
	Page     int   `json:"page"`
	PageSize int   `json:"pageSize"`
}

func Paged[T any](c *gin.Context, items []T, total int64, page, pageSize int) {
	if items == nil {
		items = []T{}
	}
	OK(c, Pager[T]{Items: items, Total: total, Page: page, PageSize: pageSize})
}

func classify(err error) (int, int, string) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		return http.StatusNotFound, 40400, "resource not found"
	case errors.Is(err, domain.ErrTOTPRequired):
		return http.StatusUnauthorized, 40101, "totp required"
	case errors.Is(err, domain.ErrUnauthorized):
		return http.StatusUnauthorized, 40100, "unauthorized"
	case errors.Is(err, domain.ErrForbidden):
		return http.StatusForbidden, 40300, "forbidden"
	case errors.Is(err, domain.ErrInvalidArgument):
		return http.StatusBadRequest, 40000, "invalid argument"
	case errors.Is(err, domain.ErrConflict), errors.Is(err, domain.ErrAlreadyExists):
		return http.StatusConflict, 40900, "conflict"
	case errors.Is(err, domain.ErrSubmissionTooFast):
		return http.StatusTooManyRequests, 42900, "too many submissions"
	case errors.Is(err, domain.ErrRateLimited):
		return http.StatusTooManyRequests, 42900, "rate limit exceeded"
	case errors.Is(err, domain.ErrUnavailable):
		return http.StatusServiceUnavailable, 50300, "service unavailable"
	default:
		return http.StatusInternalServerError, 50000, "internal server error"
	}
}
