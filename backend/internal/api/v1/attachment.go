package v1

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type AttachmentHandler struct {
	svc *service.AttachmentService
}

func NewAttachmentHandler(s *service.AttachmentService) *AttachmentHandler {
	return &AttachmentHandler{svc: s}
}

func (h *AttachmentHandler) List(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	as, err := h.svc.ListByChallenge(c.Request.Context(), uint(id))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, as)
}

func (h *AttachmentHandler) Upload(c *gin.Context) {
	chalID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	file, err := c.FormFile("file")
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	a, err := h.svc.Upload(c.Request.Context(), uint(chalID), file)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Created(c, a)
}

func (h *AttachmentHandler) Download(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("attachmentId"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	rc, a, err := h.svc.Download(c.Request.Context(), uint(id))
	if err != nil {
		response.Err(c, err)
		return
	}
	defer rc.Close()

	c.Header("Content-Disposition", "attachment; filename=\""+a.Filename+"\"")
	c.Header("Content-Type", a.MimeType)
	c.Status(200)
	_, _ = copyOut(c.Writer, rc)
}

func (h *AttachmentHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("attachmentId"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.Delete(c.Request.Context(), uint(id)); err != nil {
		response.Err(c, err)
		return
	}
	response.NoContent(c)
}
