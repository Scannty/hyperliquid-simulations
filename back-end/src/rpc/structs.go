package evm

// Default request format
type RPCRequest struct {
	JSONPRC string   `json:"jsonrpc"`
	ID      string   `json:"id"`
	Method  string   `json:"method"`
	Params  []string `json:"params,omitempty"`
}

// eth_sendTransaction request format
type Params struct {
	To   string `json:"to"`
	Data string `json:"data"`
}
type RPCRequestCall struct {
	JSONPRC string   `json:"jsonrpc"`
	ID      string   `json:"id"`
	Method  string   `json:"method"`
	Params  []Params `json:"params"`
}

// Default response format
type RPCResponse struct {
	Result string `json:"result"`
}

// debug_traceTransaction with callTracer response format
type CallTrace struct {
	Type         string      `json:"type"`
	From         string      `json:"from"`
	To           string      `json:"to"`
	Value        string      `json:"value"`
	Gas          interface{} `json:"gas"`          // Can be string or number
	GasUsed      interface{} `json:"gasUsed"`      // Can be string or number
	Input        string      `json:"input"`
	Output       string      `json:"output,omitempty"`
	Error        string      `json:"error,omitempty"`
	RevertReason string      `json:"revertReason,omitempty"`
	Calls        []CallTrace `json:"calls,omitempty"`
	Depth        int         `json:"-"` // Added for compatibility, not from JSON response
}

type RPCResponseCallTrace struct {
	Result CallTrace `json:"result"`
}

// debug_traceTransaction response format
type StructLogs struct {
	Depth   int    `json:"depth"`
	Gas     int    `json:"gas"`
	GasCost int    `json:"gasCost"`
	Op      string `json:"op"`
	Pc      int    `json:"pc"`
	Stack   []any  `json:"stack"`
}
type DebugResult struct {
	Failed      bool         `json:"failed"`
	Gas         interface{}  `json:"gas"` // Can be string or number
	ReturnValue string       `json:"returnValue"`
	StructLogs  []StructLogs `json:"structLogs"`
}
type RPCResponseDebug struct {
	Result DebugResult `json:"result"`
}
