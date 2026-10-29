package mailer

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"

	"gopkg.in/gomail.v2"
)

/**
 * Mailer abstracts outbound email so the rest of the codebase doesn't care
 * whether we're using SMTP, a log file, or a no-op stub.
 *
 * Drivers:
 *   - "console" (default): writes the message to stderr/log so dev environments
 *     can see verification links without an SMTP server.
 *   - "smtp": real delivery via gopkg.in/gomail.v2.
 *   - "off": silently discards every Send() — useful for tests.
 */

type Message struct {
	To      string
	Subject string
	Body    string // plain text
	HTML    string // optional HTML body
}

type Mailer interface {
	Send(ctx context.Context, msg Message) error
}

// Config selects the driver and SMTP parameters.
type Config struct {
	Driver   string // "console" | "smtp" | "off"
	From     string // From address used in all messages
	SMTPHost string
	SMTPPort int
	SMTPUser string
	SMTPPass string
	SMTPFrom string // overrides From if set (some services require a specific From)
	UseTLS   bool   // STARTTLS / TLS
}

func New(cfg Config) Mailer {
	switch strings.ToLower(strings.TrimSpace(cfg.Driver)) {
	case "smtp":
		return &smtpMailer{cfg: cfg}
	case "off", "disable", "disabled":
		return &noopMailer{}
	default:
		return &consoleMailer{out: os.Stderr, from: cfg.From}
	}
}

// ----- console -----

type consoleMailer struct {
	mu   sync.Mutex
	out  io.Writer
	from string
}

func (m *consoleMailer) Send(ctx context.Context, msg Message) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, err := fmt.Fprintf(m.out,
		"\n--- MAIL ---\n"+
			"from:    %s\n"+
			"to:      %s\n"+
			"subject: %s\n"+
			"---- body ----\n"+
			"%s\n"+
			"-------------\n",
		m.from, msg.To, msg.Subject, indentLines(msg.Body, "  "))
	return err
}

func indentLines(s, prefix string) string {
	lines := strings.Split(s, "\n")
	for i, l := range lines {
		lines[i] = prefix + l
	}
	return strings.Join(lines, "\n")
}

// ----- smtp -----

type smtpMailer struct {
	cfg Config
}

func (m *smtpMailer) Send(ctx context.Context, msg Message) error {
	from := m.cfg.SMTPFrom
	if from == "" {
		from = m.cfg.From
	}
	mail := gomail.NewMessage()
	mail.SetHeader("From", from)
	mail.SetHeader("To", msg.To)
	mail.SetHeader("Subject", msg.Subject)
	if msg.HTML != "" {
		mail.SetBody("text/plain", msg.Body)
		mail.AddAlternative("text/html", msg.HTML)
	} else {
		mail.SetBody("text/plain", msg.Body)
	}
	d := gomail.NewDialer(m.cfg.SMTPHost, m.cfg.SMTPPort, m.cfg.SMTPUser, m.cfg.SMTPPass)
	if m.cfg.UseTLS {
		d.TLSConfig = &tls.Config{ServerName: m.cfg.SMTPHost}
	}
	return d.DialAndSend(mail)
}

// ----- off -----

type noopMailer struct{}

func (noopMailer) Send(ctx context.Context, msg Message) error { return nil }
