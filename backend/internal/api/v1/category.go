package v1

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/api/middleware"
	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

func getUID(c *gin.Context) (uint, bool) {
	return middleware.CurrentUserID(c)
}

type CategoryHandler struct {
	svc   *service.CategoryService
	audit *service.AuditService
}

func NewCategoryHandler(s *service.CategoryService, audit *service.AuditService) *CategoryHandler {
	return &CategoryHandler{svc: s, audit: audit}
}

type categoryReq struct {
	Name        string `json:"name" binding:"required"`
	Slug        string `json:"slug" binding:"required"`
	Description string `json:"description"`
	SortOrder   int    `json:"sortOrder"`
}

func (h *CategoryHandler) List(c *gin.Context) {
	cs, err := h.svc.List(c.Request.Context())
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, cs)
}

func (h *CategoryHandler) Create(c *gin.Context) {
	var req categoryReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	cat := &domain.Category{
		Name:        req.Name,
		Slug:        req.Slug,
		Description: req.Description,
		SortOrder:   req.SortOrder,
	}
	if err := h.svc.Create(c.Request.Context(), cat); err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "category.create", "category", cat.ID, map[string]string{"name": cat.Name})
	response.Created(c, cat)
}

func (h *CategoryHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	cat, err := h.svc.Find(c.Request.Context(), uint(id))
	if err != nil {
		response.Err(c, err)
		return
	}
	var req categoryReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	cat.Name = req.Name
	cat.Slug = req.Slug
	cat.Description = req.Description
	cat.SortOrder = req.SortOrder
	if err := h.svc.Update(c.Request.Context(), cat); err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "category.update", "category", cat.ID, map[string]string{"name": cat.Name})
	response.OK(c, cat)
}

func (h *CategoryHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.Delete(c.Request.Context(), uint(id)); err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "category.delete", "category", uint(id), nil)
	response.NoContent(c)
}
