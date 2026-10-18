package v1

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type InstanceHandler struct {
	svc *service.InstanceService
}

func NewInstanceHandler(svc *service.InstanceService) *InstanceHandler {
	return &InstanceHandler{svc: svc}
}

func (h *InstanceHandler) Start(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	res, err := h.svc.Start(c.Request.Context(), uid, uint(id))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, res)
}

func (h *InstanceHandler) GetActive(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	inst, err := h.svc.GetActive(c.Request.Context(), uid, uint(id))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, inst)
}

type extendReq struct {
	TTLSeconds int `json:"ttlSeconds"`
}

func (h *InstanceHandler) Extend(c *gin.Context) {
	instanceID, err := strconv.ParseUint(c.Param("instanceId"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	var req extendReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	ttl := time.Duration(req.TTLSeconds) * time.Second
	inst, err := h.svc.Extend(c.Request.Context(), uid, uint(instanceID), ttl)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, inst)
}

func (h *InstanceHandler) Stop(c *gin.Context) {
	instanceID, err := strconv.ParseUint(c.Param("instanceId"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	if err := h.svc.Stop(c.Request.Context(), uid, uint(instanceID)); err != nil {
		response.Err(c, err)
		return
	}
	response.NoContent(c)
}

func (h *InstanceHandler) ListMine(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	is, err := h.svc.ListMine(c.Request.Context(), uid)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, is)
}
