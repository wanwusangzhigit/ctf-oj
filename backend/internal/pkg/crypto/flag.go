package crypto

import (
	"regexp"
	"strings"
)

type FlagMatcher struct {
	kind          string
	content       string
	caseSensitive bool
	re            *regexp.Regexp
}

func NewFlagMatcher(kind, content string, caseSensitive bool) (*FlagMatcher, error) {
	m := &FlagMatcher{
		kind:          kind,
		content:       content,
		caseSensitive: caseSensitive,
	}
	if kind == "regex" {
		re, err := regexp.Compile(content)
		if err != nil {
			return nil, err
		}
		m.re = re
	}
	return m, nil
}

func (m *FlagMatcher) Match(input string) bool {
	a := input
	b := m.content
	if !m.caseSensitive {
		a = strings.ToLower(a)
		b = strings.ToLower(b)
	}
	switch m.kind {
	case "regex":
		if m.re == nil {
			return false
		}
		return m.re.MatchString(input)
	default:
		return strings.TrimSpace(a) == strings.TrimSpace(b)
	}
}
