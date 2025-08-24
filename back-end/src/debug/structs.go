package debug

// Structs used when returning called contracts
type ContractCalled struct {
	ContractAddress   string     `json:"contractAddress"`
	CallType          string     `json:"callType"`
	FunctionSignature string     `json:"functionSignature"`
	Arguments         []Argument `json:"arguments"`
}

type Argument struct {
	Name  string `json:"name"`
	Type  string `json:"type"`
	Value string `json:"value"`
}

type CallTrace struct {
	Opcode          string
	LineNumber      int
	File            string
	ContractAddress string
	Depth           int
}

// SourceMapping struct as stored in output/compiledContracts
type CompiledContract struct {
	Srcmap  string            `json:"srcmap"`
	Sources map[string]string `json:"sources"`
}

// StandardJsonInput struct
type StandardJsonInput struct {
	Sources map[string]InputFile `json:"sources"`
}

type InputFile struct {
	Content string `json:"content"`
}

// Contract compiled from a single file
type SingleCompiledContract struct {
	Contracts map[string]SourceMap `json:"contracts"`
}

type SourceMap struct {
	Srcmap string `json:"srcmap-runtime"`
}

// JsonCompiledContract Contract compiled from a standard input JSON
type JsonCompiledContract struct {
	Contracts map[string]map[string]Contract `json:"contracts"`
	Sources   map[string]Source              `json:"sources"`
}

type Contract struct {
	Evm struct {
		DeployedBytecode struct {
			SourceMap string `json:"sourceMap"`
		} `json:"deployedBytecode"`
	} `json:"evm"`
}

type Source struct {
	Id int `json:"id"`
}

// SourceMap entry struct
type Opcode struct {
	Offset        string
	Length        string
	FileID        string
	JumpType      string
	ModifierDepth string
}

// Contract entry struct
type ContractEntry struct {
	address               string
	bytecode              string
	sourceCodes           map[string]string
	fileNames             map[string]string
	decompressedSourceMap []Opcode
}
