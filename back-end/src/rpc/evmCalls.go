package evm

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type forkService interface {
	ForwardRpcRequest(forkId string, rawData []byte) (*http.Response, error)
}

type Service struct {
	forkService forkService
}

func NewService(forkService forkService) *Service {
	return &Service{
		forkService: forkService,
	}
}

func (s *Service) GetBalance(forkId, userAddress string) (int, string, error) {
	rpcRequest := RPCRequest{
		JSONPRC: "2.0",
		ID:      "2",
		Method:  "eth_getBalance",
		Params:  []string{userAddress, "latest"},
	}

	rawData, err := json.Marshal(rpcRequest)
	if err != nil {
		return http.StatusBadRequest, "", err
	}

	statusCode, resData, err := s.SendRpcRequest(forkId, rawData)
	if err != nil {
		return statusCode, "", err
	}

	var rpcRes RPCResponse
	errDecode := json.Unmarshal(resData, &rpcRes)

	if errDecode != nil {
		return http.StatusInternalServerError, "", errDecode
	}

	return statusCode, rpcRes.Result, nil

}

func (s *Service) SetBalance(forkId, userAddress, balance string) (int, error) {
	rpcRequest := RPCRequest{
		JSONPRC: "2.0",
		ID:      "1",
		Method:  "anvil_setBalance",
		Params:  []string{userAddress, balance},
	}

	rawData, err := json.Marshal(rpcRequest)
	if err != nil {
		return http.StatusInternalServerError, err
	}

	statusCode, _, err := s.SendRpcRequest(forkId, rawData)
	if err != nil {
		return statusCode, err
	}

	return statusCode, err
}

func (s *Service) ChangeStorageSlot(forkId, tokenAddress, value, slot string) error {
	rpcRequest := RPCRequest{
		JSONPRC: "2.0",
		ID:      "5",
		Method:  "anvil_setStorageAt",
		Params:  []string{tokenAddress, slot, value},
	}

	rawData, err := json.Marshal(rpcRequest)
	if err != nil {
		return err
	}

	_, _, parseErr := s.SendRpcRequest(forkId, rawData)
	if parseErr != nil {
		return parseErr
	}

	return nil
}

func (s *Service) GetCurrentSnapshot(forkId string) (string, error) {
	rpcReq := RPCRequest{
		JSONPRC: "2.0",
		ID:      "3",
		Method:  "evm_snapshot",
	}

	rawData, err := json.Marshal(rpcReq)
	if err != nil {
		return "", err
	}

	_, resData, err := s.SendRpcRequest(forkId, rawData)
	if err != nil {
		return "", err
	}

	var rpcRes RPCResponse
	err = json.Unmarshal(resData, &rpcRes)
	if err != nil {
		return "", err
	}

	return rpcRes.Result, nil
}

func (s *Service) RevertState(forkId, snapshot string) error {
	revertRequest := RPCRequest{
		JSONPRC: "2.0",
		ID:      "6",
		Method:  "evm_revert",
		Params:  []string{snapshot},
	}

	rawData, err := json.Marshal(revertRequest)
	if err != nil {
		return err
	}

	_, _, parseErr := s.SendRpcRequest(forkId, rawData)
	if parseErr != nil {
		return parseErr
	}

	return nil
}

func (s *Service) MineTx(forkId string) error {
	revertRequest := RPCRequest{
		JSONPRC: "2.0",
		ID:      "6",
		Method:  "evm_mine",
	}

	rawData, err := json.Marshal(revertRequest)
	if err != nil {
		return err
	}

	_, _, parseErr := s.SendRpcRequest(forkId, rawData)
	if parseErr != nil {
		return parseErr
	}

	return nil
}

func (s *Service) SendCallTransaction(forkId, tokenAddress, funcEncoded string) (string, error) {
	params := Params{
		To:   tokenAddress,
		Data: funcEncoded,
	}

	rpcReq := RPCRequestCall{
		JSONPRC: "2.0",
		ID:      "4",
		Method:  "eth_call",
		Params:  []Params{params},
	}

	rawData, err := json.Marshal(rpcReq)
	if err != nil {
		return "", err
	}

	_, resData, err := s.SendRpcRequest(forkId, rawData)
	if err != nil {
		return "", err
	}

	var rpcRes RPCResponse
	errDecode := json.Unmarshal(resData, &rpcRes)

	if errDecode != nil {
		return "", errDecode
	}

	return rpcRes.Result, nil
}

func (s *Service) SendRpcRequest(forkId string, rawData []byte) (int, []byte, error) {
	res, err := s.forkService.ForwardRpcRequest(forkId, rawData)
	if err != nil {
		return http.StatusBadRequest, nil, err
	}

	// Ensure response body is properly closed
	defer res.Body.Close()

	resData, err := io.ReadAll(res.Body)
	if err != nil {
		return res.StatusCode, nil, err
	}

	return res.StatusCode, resData, nil
}

func (s *Service) GetContractBytecode(forkId string, contractAddress string) (string, error) {
	rpcReq := RPCRequest{
		JSONPRC: "2.0",
		ID:      "3",
		Method:  "eth_getCode",
		Params:  []string{contractAddress, "latest"},
	}

	rawData, err := json.Marshal(rpcReq)
	if err != nil {
		return "", err
	}

	_, resData, err := s.SendRpcRequest(forkId, rawData)
	if err != nil {
		return "", err
	}

	var rpcRes RPCResponse
	err = json.Unmarshal(resData, &rpcRes)
	if err != nil {
		return "", err
	}

	return rpcRes.Result, nil
}

func (s *Service) GetTransactionTrace(forkId string, txHash string) ([]CallTrace, error) {
	type TracerConfig struct {
		Tracer string `json:"tracer"`
	}

	rpcReq := struct {
		JSONPRC string        `json:"jsonrpc"`
		ID      string        `json:"id"`
		Method  string        `json:"method"`
		Params  []interface{} `json:"params"`
	}{
		JSONPRC: "2.0",
		ID:      fmt.Sprintf("call_%d", time.Now().UnixNano()), // Unique timestamp ID
		Method:  "debug_traceTransaction",
		Params:  []interface{}{txHash, TracerConfig{Tracer: "callTracer"}},
	}

	rawData, err := json.Marshal(rpcReq)
	if err != nil {
		return nil, err
	}

	statusCode, resData, err := s.SendRpcRequest(forkId, rawData)
	fmt.Printf("🔍 Got callTracer response (status: %d, length: %d bytes)\n", statusCode, len(resData))
	if err != nil {
		fmt.Printf("❌ SendRpcRequest error: %v\n", err)
		return nil, err
	}

	if len(resData) == 0 {
		fmt.Printf("❌ Empty response from callTracer!\n")
		return nil, fmt.Errorf("empty response from callTracer")
	}

	var rpcRes RPCResponseCallTrace
	err = json.Unmarshal(resData, &rpcRes)
	if err != nil {
		fmt.Printf("❌ JSON unmarshal error: %v\n", err)
		return nil, err
	}

	// Flatten the nested call structure into a list
	var flatTraces []CallTrace
	flattenCalls(rpcRes.Result, &flatTraces, 0)

	fmt.Printf("✅ Flattened %d trace entries\n", len(flatTraces))
	if len(flatTraces) > 0 {
		fmt.Printf("🔍 First trace: From=%s, To=%s, Depth=%d\n", flatTraces[0].From, flatTraces[0].To, flatTraces[0].Depth)
	}

	return flatTraces, nil
}

// Helper function to flatten nested calls into a list
func flattenCalls(trace CallTrace, result *[]CallTrace, depth int) {
	trace.Depth = depth
	*result = append(*result, trace)
	for _, call := range trace.Calls {
		flattenCalls(call, result, depth+1)
	}
}

func (s *Service) GetOpcodeTrace(forkId string, txHash string) (DebugResult, error) {
	// Use empty config object to get struct logs (default tracer)
	rpcReq := struct {
		JSONPRC string        `json:"jsonrpc"`
		ID      string        `json:"id"`
		Method  string        `json:"method"`
		Params  []interface{} `json:"params"`
	}{
		JSONPRC: "2.0",
		ID:      fmt.Sprintf("opcode_%d", time.Now().UnixNano()), // Unique timestamp ID
		Method:  "debug_traceTransaction",
		Params:  []interface{}{txHash, map[string]interface{}{}}, // Empty config for default tracer
	}

	rawData, err := json.Marshal(rpcReq)

	if err != nil {
		return DebugResult{}, err
	}

	_, resData, err := s.SendRpcRequest(forkId, rawData)
	if err != nil {
		return DebugResult{}, err
	}

	var rpcRes RPCResponseDebug
	err = json.Unmarshal(resData, &rpcRes)
	if err != nil {
		fmt.Printf("❌ Failed to unmarshal opcode trace response: %v\n", err)
		return DebugResult{}, err
	}

	return rpcRes.Result, nil
}

func (s *Service) GetTransactionErrorMessage(forkId string, txHash string) (string, error) {
	// Check transaction receipt first - much more efficient
	rpcReq := RPCRequest{
		JSONPRC: "2.0",
		ID:      "3",
		Method:  "eth_getTransactionReceipt",
		Params:  []string{txHash},
	}

	rawData, err := json.Marshal(rpcReq)
	if err != nil {
		return "", err
	}

	_, resData, err := s.SendRpcRequest(forkId, rawData)
	if err != nil {
		return "", err
	}

	var receiptRes struct {
		Result struct {
			Status string `json:"status"`
			Logs   []struct {
				Topics []string `json:"topics"`
				Data   string   `json:"data"`
			} `json:"logs"`
		} `json:"result"`
	}

	err = json.Unmarshal(resData, &receiptRes)
	if err != nil {
		return "", err
	}

	// If transaction succeeded, no error
	if receiptRes.Result.Status == "0x1" {
		return "", nil
	}

	// Transaction failed - try to get revert reason from logs
	// Look for Error(string) event: keccak256("Error(string)") = 0x08c379a0...
	for _, log := range receiptRes.Result.Logs {
		if len(log.Topics) > 0 && log.Topics[0] == "0x08c379a0afcc32b1a39302f7cb8073359698411ab5fd6e3edb2c02c0b5fba8aa" {
			// Decode the revert reason from log data
			if len(log.Data) > 138 { // 0x + 64 chars (offset) + 64 chars (length) + at least 2 chars (data)
				// Simple decode - skip offset and length, get string data
				return log.Data, nil
			}
		}
	}

	// No specific revert reason found
	return "Transaction Failed", nil
}
