package metrics

import (
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

/**
 * metrics — Prometheus instrumentation.
 *
 * Counters track business events (submissions, solves, instance starts);
 * the default Go + process collectors are also registered so /metrics
 * returns the standard runtime + process_* series alongside our own.
 */

var (
	SubmissionsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{Name: "ctfoj_submissions_total", Help: "Total flag submissions."},
		[]string{"challenge_id", "result"},
	)
	SolvesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{Name: "ctfoj_solves_total", Help: "Total successful solves."},
		[]string{"challenge_id"},
	)
	InstanceStartsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{Name: "ctfoj_instance_starts_total", Help: "Total container instance starts."},
		[]string{"challenge_id", "source_type"},
	)
	InstanceErrorsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{Name: "ctfoj_instance_errors_total", Help: "Total container instance errors."},
		[]string{"challenge_id"},
	)
	RegistrationsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "ctfoj_registrations_total", Help: "Total user registrations.",
	})
	LoginsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "ctfoj_logins_total", Help: "Total login attempts (success + failure).",
	})
)

func init() {
	prometheus.MustRegister(
		SubmissionsTotal,
		SolvesTotal,
		InstanceStartsTotal,
		InstanceErrorsTotal,
		RegistrationsTotal,
		LoginsTotal,
	)
}

// Handler is mounted at /metrics.
func Handler(c *gin.Context) {
	promhttp.Handler().ServeHTTP(c.Writer, c.Request)
}
