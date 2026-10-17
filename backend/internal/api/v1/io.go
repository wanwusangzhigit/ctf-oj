package v1

import (
	"io"
	"net/http"
)

func copyOut(w http.ResponseWriter, r io.Reader) (int64, error) {
	return io.Copy(w, r)
}
