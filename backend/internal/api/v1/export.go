package v1

import (
	"bytes"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type ExportHandler struct {
	svc *service.ExportService
}

func NewExportHandler(s *service.ExportService) *ExportHandler {
	return &ExportHandler{svc: s}
}

func (h *ExportHandler) Export(c *gin.Context) {
	buf := &bytes.Buffer{}
	if err := h.svc.Export(c.Request.Context(), buf); err != nil {
		response.Err(c, err)
		return
	}
	c.Header("Content-Disposition", `attachment; filename="ctfoj-export.json"`)
	c.Data(http.StatusOK, "application/json; charset=utf-8", buf.Bytes())
}

func (h *ExportHandler) Import(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, 50*1024*1024))
	if err != nil {
		response.Err(c, err)
		return
	}
	summary, err := h.svc.Import(c.Request.Context(), bytes.NewReader(data), uid)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, summary)
}
