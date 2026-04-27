package migrate

import "testing"

func TestStripScheme(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "postgres scheme",
			in:   "postgres://user:pass@host:5432/db?sslmode=disable",
			want: "user:pass@host:5432/db?sslmode=disable",
		},
		{
			name: "postgresql scheme",
			in:   "postgresql://user:pass@host:5432/db",
			want: "user:pass@host:5432/db",
		},
		{
			name: "no scheme passthrough",
			in:   "user:pass@host:5432/db",
			want: "user:pass@host:5432/db",
		},
		{
			name: "empty string",
			in:   "",
			want: "",
		},
		{
			name: "scheme-like prefix but not exact",
			in:   "postgres-fake://x",
			want: "postgres-fake://x",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := stripScheme(tc.in); got != tc.want {
				t.Errorf("stripScheme(%q): want %q, got %q", tc.in, tc.want, got)
			}
		})
	}
}
