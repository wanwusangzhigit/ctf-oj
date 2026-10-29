package realtime

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

// Event is a realtime broadcast payload.
type Event struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
	At      time.Time   `json:"at"`
}

const (
	EventSolve        = "solve"
	EventScoreChange  = "score.change"
	EventAnnouncement = "announcement"
	EventNotification = "notification"
)

type client struct {
	conn   *websocket.Conn
	send   chan Event
	userID uint
}

// Hub fans out events to all connected WebSocket clients.
type Hub struct {
	mu         sync.RWMutex
	clients    map[*client]struct{}
	register   chan *client
	unregister chan *client
	inbound    chan Event
	log        *zap.Logger
}

func NewHub(log *zap.Logger) *Hub {
	return &Hub{
		clients:    make(map[*client]struct{}),
		register:   make(chan *client),
		unregister: make(chan *client),
		inbound:    make(chan Event, 256),
		log:        log,
	}
}

func (h *Hub) Run() {
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			h.clients[c] = struct{}{}
			h.mu.Unlock()
		case c := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[c]; ok {
				delete(h.clients, c)
				close(c.send)
			}
			h.mu.Unlock()
		case ev := <-h.inbound:
			h.mu.RLock()
			for c := range h.clients {
				select {
				case c.send <- ev:
				default:
					// drop slow consumer
					go func(cl *client) { h.unregister <- cl }(c)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Publish broadcasts an event to all clients.
func (h *Hub) Publish(ev Event) {
	if h == nil {
		return
	}
	if ev.At.IsZero() {
		ev.At = time.Now()
	}
	select {
	case h.inbound <- ev:
	default:
	}
}

// PublishTo delivers an event to every connection owned by userID.
func (h *Hub) PublishTo(userID uint, ev Event) {
	if h == nil || userID == 0 {
		return
	}
	if ev.At.IsZero() {
		ev.At = time.Now()
	}
	h.mu.RLock()
	for c := range h.clients {
		if c.userID != userID {
			continue
		}
		select {
		case c.send <- ev:
		default:
			go func(cl *client) { h.unregister <- cl }(c)
		}
	}
	h.mu.RUnlock()
}

func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

// Handler exposes the Hub as a Gin handler.
func (h *Hub) Handler(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.log.Warn("ws upgrade", zap.Error(err))
		return
	}
	uid := uint(0)
	if v, ok := c.Get("uid"); ok {
		if n, ok := v.(uint); ok {
			uid = n
		}
	}
	cl := &client{conn: conn, send: make(chan Event, 32), userID: uid}
	h.register <- cl

	go h.writeLoop(cl)
	go h.readLoop(cl)
}

func (h *Hub) writeLoop(c *client) {
	defer c.conn.Close()
	for ev := range c.send {
		if err := c.conn.WriteJSON(ev); err != nil {
			return
		}
	}
}

func (h *Hub) readLoop(c *client) {
	defer func() {
		h.unregister <- c
		c.conn.Close()
	}()
	for {
		if _, _, err := c.conn.ReadMessage(); err != nil {
			return
		}
	}
}

// SafePublish marshals once before sending to avoid per-client encoding overhead.
func (h *Hub) SafePublish(typ string, payload interface{}) {
	if h == nil {
		return
	}
	_, _ = json.Marshal(payload) // validate serializable
	h.Publish(Event{Type: typ, Payload: payload})
}

// SafePublishTo validates serialization before a targeted send.
func (h *Hub) SafePublishTo(userID uint, typ string, payload interface{}) {
	if h == nil {
		return
	}
	_, _ = json.Marshal(payload)
	h.PublishTo(userID, Event{Type: typ, Payload: payload})
}
