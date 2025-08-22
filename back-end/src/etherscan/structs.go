package etherscan

// Etherscan API response structs
type SourceCodeInfo struct {
	SourceCode       string
	ContractName     string
	CompilerVersion  string
	OptimizationUsed string
	Runs             string
	EVMVersion       string
	IsStandardJSON   bool
}

type SourceCodeResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	Result  []struct {
		SourceCode       string `json:"SourceCode"`
		ContractName     string `json:"ContractName"`
		CompilerVersion  string `json:"CompilerVersion"`
		OptimizationUsed string `json:"OptimizationUsed"`
		Runs             string `json:"Runs"`
		EVMVersion       string `json:"EVMVersion"`
	}
}

type ErrorResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	Result  string `json:"result"`
}

type AbiResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	Result  string `json:"result"`
}
