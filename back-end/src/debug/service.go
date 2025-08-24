package debug

import (
	"Simulations/src/etherscan"
	evm "Simulations/src/rpc"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"

	"os"
)

type forkService interface {
	CreateFork(forkDuration int) (string, error)
	DeleteFork(forkId string) error
}

type etherscanService interface {
	GetSourceCodeInfo(address string) (etherscan.SourceCodeInfo, error)
	GetAbi(address string) (string, error)
}

type evmService interface {
	GetContractBytecode(forkId string, contractAddress string) (string, error)
	GetTransactionTrace(forkId string, txHash string) ([]evm.CallTrace, error)
	GetOpcodeTrace(forkId string, txHash string) (evm.DebugResult, error)
	GetTransactionErrorMessage(forkId string, txHash string) (string, error)
	SendRpcRequest(forkId string, rawData []byte) (int, []byte, error)
	MineTx(forkId string) error
}

type Service struct {
	forkService      forkService
	etherscanService etherscanService
	evmService       evmService
}

func NewService(forkService forkService, etherscanService etherscanService, evmService evmService) *Service {
	return &Service{
		forkService:      forkService,
		etherscanService: etherscanService,
		evmService:       evmService,
	}
}

// isTargetOpcode checks if an opcode should be included in the filtered trace
func isTargetOpcode(opcode string) bool {
	targetOpcodes := []string{
		"CALL", "DELEGATECALL", "STATICCALL", "CREATE", "CREATE2",
		"SLOAD", "SSTORE", "LOG0", "LOG1", "LOG2", "LOG3", "LOG4",
		"REVERT", "JUMP",
	}

	for _, target := range targetOpcodes {
		if opcode == target {
			return true
		}
	}
	return false
}

func (s *Service) DebugTransaction(forkId string, txHash string) (int, string, []CallTrace, error) {
	fmt.Printf("🔍 DEBUG DebugTransaction called with forkId: %s, txHash: %s\n", forkId, txHash)

	// GET OPCODE TRACE FIRST - before any other API calls
	fmt.Printf("🔍 Getting opcode trace FIRST...\n")
	debugTrace, err := s.evmService.GetOpcodeTrace(forkId, txHash)
	if err != nil {
		fmt.Printf("❌ Failed to get opcode trace: %v\n", err)
		return -1, "", nil, err
	}
	fmt.Printf("✅ Got opcode trace with %d struct logs\n", len(debugTrace.StructLogs))

	// WORKAROUND: Create a new fork for call trace due to Alchemy bug
	// where debug_traceTransaction corrupts fork state for subsequent calls
	helperForkId, err := s.forkService.CreateFork(1)
	if err != nil {
		fmt.Printf("❌ Failed to create helper fork for call trace: %v\n", err)
		return -1, "", nil, err
	}
	fmt.Printf("🔄 Created helper fork %s for call trace\n", helperForkId)

	// Wait for Anvil to start up
	fmt.Printf("⏳ Waiting 3 seconds for Anvil to start...\n")
	time.Sleep(3 * time.Second)
	fmt.Printf("✅ Anvil should be ready now\n")

	trace, err := s.evmService.GetTransactionTrace(helperForkId, txHash)
	if err != nil {
		fmt.Printf("❌ Failed to get transaction trace: %v\n", err)
		return -1, "", nil, err
	}
	fmt.Printf("✅ Got %d trace entries\n", len(trace))

	if len(trace) == 0 {
		fmt.Printf("❌ No transaction trace found\n")
		return -1, "", nil, errors.New("no transcation trace")
	}

	contractMap := make(map[int]ContractEntry)

	fmt.Printf("🔍 Processing %d trace entries for contracts...\n", len(trace))
	for i, traceEntry := range trace {
		fmt.Printf("   [%d/%d] Processing contract: %s\n", i+1, len(trace), traceEntry.To)

		contractBytecode, err := s.evmService.GetContractBytecode(helperForkId, traceEntry.To)
		if err != nil {
			fmt.Printf("❌ Failed to get bytecode for %s: %v\n", traceEntry.To, err)
			return -1, "", nil, err
		}
		fmt.Printf("   ✅ Got bytecode (length: %d)\n", len(contractBytecode))

		sourceCodes, err := s.GetSourceCode(traceEntry.To)
		if err != nil {
			fmt.Printf("❌ Failed to get source code for %s: %v\n", traceEntry.To, err)
			return -1, "", nil, err
		}

		// Check if this is an unverified contract
		isUnverified := false
		if len(sourceCodes) == 1 {
			for filename, content := range sourceCodes {
				if filename == "unverified.sol" && strings.Contains(content, "No source code available") {
					isUnverified = true
					break
				}
			}
		}

		if isUnverified {
			fmt.Printf("⚠️  Contract %s is unverified, using placeholder\n", traceEntry.To)
		} else {
			fmt.Printf("   ✅ Got source code (%d files)\n", len(sourceCodes))
		}

		compiledContract, err := s.GetSourceMappingAndFileNames(traceEntry.To)
		if err != nil {
			fmt.Printf("❌ Failed to get source mapping for %s: %v\n", traceEntry.To, err)
			return -1, "", nil, err
		}

		if isUnverified {
			fmt.Printf("   ⚠️  Using placeholder source mapping for unverified contract\n")
		} else {
			fmt.Printf("   ✅ Got source mapping (%d sources)\n", len(compiledContract.Sources))
		}

		depth := traceEntry.Depth + 1
		contractMap[depth] = ContractEntry{
			address:               traceEntry.To,
			bytecode:              contractBytecode,
			sourceCodes:           sourceCodes,
			fileNames:             compiledContract.Sources,
			decompressedSourceMap: decompressSourceMap(compiledContract.Srcmap),
		}
	}
	fmt.Printf("✅ Finished processing contracts, got %d entries in contractMap\n", len(contractMap))

	fmt.Printf("🔍 Getting transaction error message...\n")
	revertReason, err := s.evmService.GetTransactionErrorMessage(forkId, txHash)
	if err != nil {
		fmt.Printf("❌ Failed to get transaction error message: %v\n", err)
		return -1, "", nil, err
	}
	fmt.Printf("✅ Got revert reason: '%s'\n", revertReason)

	// Clean up helper fork
	err = s.forkService.DeleteFork(helperForkId)
	if err != nil {
		fmt.Printf("⚠️  Failed to delete helper fork %s: %v\n", helperForkId, err)
	} else {
		fmt.Printf("🧹 Cleaned up helper fork %s\n", helperForkId)
	}

	var errorMessage string
	if revertReason == "0x" || revertReason == "" {
		errorMessage = "Transaction successful!"
	} else {
		errorMessage = revertReason
	}

	fmt.Printf("🔍 Processing opcodes for debugging...\n")
	opcodes := debugTrace.StructLogs
	if len(opcodes) == 0 {
		fmt.Printf("❌ No opcodes found in debug trace\n")
		return -1, "", nil, errors.New("no debug trace detected")
	}
	fmt.Printf("✅ Found %d opcodes to process\n", len(opcodes))
	fmt.Printf("📊 Contract map has %d entries\n", len(contractMap))

	var filteredOpcodes []CallTrace

	for i, structLog := range debugTrace.StructLogs {
		fmt.Printf("🔍 Processing structLog #%d: Op=%s, PC=%d, Depth=%d\n", i, structLog.Op, structLog.Pc, structLog.Depth)
		contract := contractMap[structLog.Depth]

		fmt.Printf(" Contract: %s, Bytecode length: %d\n", contract.address, len(contract.bytecode))

		// Check if this is an unverified contract
		isUnverified := false
		if len(contract.sourceCodes) == 1 {
			for filename, content := range contract.sourceCodes {
				if filename == "unverified.sol" && strings.Contains(content, "No source code available") {
					isUnverified = true
					break
				}
			}
		}

		if isUnverified {
			// For unverified contracts, include only target opcodes with placeholder source info
			if isTargetOpcode(structLog.Op) {
				filteredOpcodes = append(
					filteredOpcodes,
					CallTrace{
						Opcode:          structLog.Op,
						LineNumber:      1,
						File:            "unverified.sol",
						ContractAddress: contract.address,
						Depth:           structLog.Depth,
					},
				)
			}
			continue
		}

		// Always get opcodeNumber, even for unverified contracts
		opcodeNumber, err := s.getOpcodeNumber(structLog.Pc, contract.bytecode)
		if err != nil {
			fmt.Printf("⚠️ Could not find PC %d in bytecode, adding opcode with unknown location\n", structLog.Pc)
			// Add opcode with placeholder info when PC can't be found
			if isTargetOpcode(structLog.Op) {
				filteredOpcodes = append(
					filteredOpcodes,
					CallTrace{
						Opcode:          structLog.Op,
						LineNumber:      -1, // Unknown line
						File:            "unknown",
						ContractAddress: contract.address,
						Depth:           structLog.Depth,
					},
				)
			}
			continue
		}

		// Check bounds before accessing decompressedSourceMap
		if opcodeNumber >= len(contract.decompressedSourceMap) {
			fmt.Printf("⚠️ Opcode number %d is out of bounds (source map length: %d), adding with unknown location\n",
				opcodeNumber, len(contract.decompressedSourceMap))
			if isTargetOpcode(structLog.Op) {
				filteredOpcodes = append(
					filteredOpcodes,
					CallTrace{
						Opcode:          structLog.Op,
						LineNumber:      -1,
						File:            "unknown",
						ContractAddress: contract.address,
						Depth:           structLog.Depth,
					},
				)
			}
			continue
		}

		if isTargetOpcode(structLog.Op) {
			fileId := contract.decompressedSourceMap[opcodeNumber].FileID
			jumpType := contract.decompressedSourceMap[opcodeNumber].JumpType

			if structLog.Op == "JUMP" && jumpType == "-" {
				fmt.Println("Jump type not supported.")
				continue
			}

			if !fileIdValid(fileId, contract.sourceCodes) {
				fmt.Printf("⚠️  Invalid fileId %s, skipping\n", fileId)
				continue
			}

			// Check bounds for fileNames map
			if _, exists := contract.fileNames[fileId]; !exists {
				fmt.Printf("⚠️  FileId %s not found in fileNames map, skipping\n", fileId)
				continue
			}

			bytesOffset := contract.decompressedSourceMap[opcodeNumber].Offset
			fileName := contract.fileNames[fileId]

			// Check if source code exists for this file
			sourceCode, exists := contract.sourceCodes[fileName]
			if !exists {
				fmt.Printf("⚠️  Source code not found for file %s, skipping\n", fileName)
				continue
			}

			lineNumber, err := getLineNumber([]byte(sourceCode), bytesOffset)
			if err != nil {
				fmt.Println("NOOOOOO", err)
				return -1, "", nil, err
			}

			if len(filteredOpcodes) != 0 && filteredOpcodes[len(filteredOpcodes)-1].LineNumber == lineNumber && structLog.Op != "RETURN" {
				continue
			}

			filteredOpcodes = append(
				filteredOpcodes,
				CallTrace{
					Opcode:          structLog.Op,
					LineNumber:      lineNumber,
					File:            fileName,
					ContractAddress: contract.address,
					Depth:           structLog.Depth,
				},
			)
		}
	}

	return filteredOpcodes[len(filteredOpcodes)-1].LineNumber, errorMessage, filteredOpcodes, nil
}

func (s *Service) SimulateRawTransaction(rawData []byte) ([]ContractCalled, int, string, []CallTrace, error) {
	// Create New Fork
	forkId, err := s.forkService.CreateFork(1)
	if err != nil {
		return nil, 0, "", nil, err
	}

	// Wait for the fork to start
	time.Sleep(time.Second * 3)

	// Send the rpc request
	_, resData, err := s.evmService.SendRpcRequest(forkId, rawData)
	if err != nil {
		fmt.Println("hey", err)
		return nil, 0, "", nil, err
	}

	// Decode data
	var res evm.RPCResponse
	errDecode := json.Unmarshal(resData, &res)
	if errDecode != nil {
		return nil, 0, "", nil, errDecode
	}

	// Mine the transaction
	errMine := s.evmService.MineTx(forkId)
	if errMine != nil {
		return nil, 0, "", nil, errMine
	}

	// Get the tx hash
	txHash := res.Result

	// Get contracts called
	contractsCalled, err := s.GetContractsCalled(forkId, txHash)
	if err != nil {
		return nil, 0, "", nil, err
	}

	// Debug the transaction
	errorLineNumber, revertReason, debugTrace, err := s.DebugTransaction(forkId, txHash)
	if err != nil {
		return nil, 0, "", nil, err
	}

	// Deactivate the fork
	errDelete := s.forkService.DeleteFork(forkId)
	if errDelete != nil {
		return nil, 0, "", nil, errDelete
	}

	return contractsCalled, errorLineNumber, revertReason, debugTrace, nil
}

func (s *Service) GetLastAddressCalled(forkId string, txHash string) (string, error) {
	trace, err := s.evmService.GetTransactionTrace(forkId, txHash)
	if err != nil {
		return "", err
	}

	fmt.Println("trace", trace)

	if len(trace) == 0 {
		return "", errors.New("no transcation trace")
	}

	lastCall := trace[len(trace)-1]

	return lastCall.To, nil
}

func (s *Service) getOpcodeNumber(opcodePC int, contractBytecode string) (int, error) {
	fmt.Printf("🔍 DEBUG getOpcodeNumber: Looking for PC %d in bytecode (length: %d)\n", opcodePC, len(contractBytecode))

	pc := 0
	opcodeCounter := 0

	for i := 2; i < len(contractBytecode)-1; i += 2 {
		// Check if we're at the target PC before processing this opcode
		if pc == opcodePC {
			fmt.Printf("✅ Found exact PC %d at opcode #%d\n", opcodePC, opcodeCounter)
			return opcodeCounter, nil
		}

		opcode := contractBytecode[i : i+2]
		opcodeCounter++

		opcodeInt, err := strconv.ParseInt(opcode, 16, 64)
		if err != nil {
			fmt.Printf("❌ Failed to parse opcode %s: %v\n", opcode, err)
			return 0, err
		}

		if opcodeInt > 0x5f && opcodeInt < 0x80 {
			increment := int(opcodeInt - 0x5f)
			nextPC := pc + increment + 1

			// Check if target PC falls within this PUSH instruction's range
			if opcodePC > pc && opcodePC < nextPC {
				fmt.Printf("✅ Found PC %d within PUSH%d range (PC %d-%d), returning opcode #%d\n",
					opcodePC, increment, pc, nextPC-1, opcodeCounter)
				return opcodeCounter, nil
			}

			pc = nextPC
			i += increment * 2
		} else {
			pc++
		}
	}

	fmt.Printf("❌ Could not find PC %d in bytecode. Final PC: %d, Opcodes processed: %d\n", opcodePC, pc, opcodeCounter)
	return 0, errors.New("couldn't find the instruction number")
}

func (s *Service) GetContractsCalled(forkId string, txHash string) ([]ContractCalled, error) {
	// WORKAROUND: Create a new fork for trace due to Alchemy bug
	// where debug_traceTransaction corrupts fork state for subsequent calls
	traceForkId, err := s.forkService.CreateFork(1)
	if err != nil {
		fmt.Printf("❌ Failed to create fork for contracts trace: %v\n", err)
		return nil, err
	}
	fmt.Printf("🔄 Created fork %s for contracts trace\n", traceForkId)

	// Wait for Anvil to start up
	fmt.Printf("⏳ Waiting 5 seconds for Anvil to start...\n")
	time.Sleep(5 * time.Second)
	fmt.Printf("✅ Anvil should be ready now\n")

	traces, err := s.evmService.GetTransactionTrace(traceForkId, txHash)
	if err != nil {
		// Clean up trace fork
		s.forkService.DeleteFork(traceForkId)
		return nil, err
	}

	// Clean up trace fork
	err = s.forkService.DeleteFork(traceForkId)
	if err != nil {
		fmt.Printf("⚠️  Failed to delete trace fork %s: %v\n", traceForkId, err)
	} else {
		fmt.Printf("🧹 Cleaned up trace fork %s\n", traceForkId)
	}

	var contractsCalled []ContractCalled
	for _, trace := range traces {
		method, params, err := s.getMethodAndParams(trace.To, trace.Input)
		if err != nil {
			contractsCalled = append(contractsCalled, ContractCalled{
				ContractAddress:   trace.To,
				CallType:          trace.Type,
				FunctionSignature: "Unknown",
				Arguments:         nil,
			})

			continue
		}

		var arguments []Argument
		for i, param := range params {
			arguments = append(arguments, Argument{
				Name:  method.Inputs[i].Name,
				Type:  method.Inputs[i].Type.String(),
				Value: fmt.Sprint(param),
			})
		}

		contractsCalled = append(contractsCalled, ContractCalled{
			ContractAddress:   trace.To,
			CallType:          trace.Type,
			FunctionSignature: method.String(),
			Arguments:         arguments,
		})
	}

	return contractsCalled, nil
}

func (s *Service) getMethodAndParams(contractAddress string, input string) (*abi.Method, []interface{}, error) {
	fmt.Printf("🔍 DEBUG getMethodAndParams called with:\n")
	fmt.Printf("   Contract: %s\n", contractAddress)
	fmt.Printf("   Input: %s\n", input)

	// Check for empty or too short input data
	if input == "0x" || len(input) < 10 {
		fmt.Printf("❌ Input data too short or empty\n")
		return nil, nil, errors.New("input data too short or empty")
	}

	contractAbi, err := s.etherscanService.GetAbi(contractAddress)
	if err != nil {
		fmt.Printf("❌ Failed to get ABI: %v\n", err)
		return nil, nil, fmt.Errorf("failed to get ABI for %s: %w", contractAddress, err)
	}
	fmt.Printf("✅ Got ABI (length: %d chars)\n", len(contractAbi))

	parsedAbi, err := abi.JSON(strings.NewReader(contractAbi))
	if err != nil {
		fmt.Printf("❌ Failed to parse ABI: %v\n", err)
		return nil, nil, fmt.Errorf("failed to parse ABI: %w", err)
	}
	fmt.Printf("✅ Parsed ABI successfully\n")

	decodedData, err := hex.DecodeString(input[2:])
	if err != nil {
		fmt.Printf("❌ Failed to decode input data: %v\n", err)
		return nil, nil, fmt.Errorf("failed to decode input data: %w", err)
	}

	if len(decodedData) < 4 {
		fmt.Printf("❌ Input data too short for method signature\n")
		return nil, nil, errors.New("input data too short for method signature")
	}

	methodSig := hex.EncodeToString(decodedData[:4])
	fmt.Printf("🎯 Method signature: 0x%s\n", methodSig)

	method, err := parsedAbi.MethodById(decodedData)
	if err != nil {
		fmt.Printf("❌ Method not found in ABI: %v\n", err)
		fmt.Printf("📋 Available methods in ABI:\n")
		for name, method := range parsedAbi.Methods {
			fmt.Printf("   - %s: 0x%x\n", name, method.ID)
		}
		return nil, nil, fmt.Errorf("method not found in ABI: %w", err)
	}
	fmt.Printf("✅ Found method: %s\n", method.Name)

	params, err := method.Inputs.Unpack(decodedData[4:])
	if err != nil {
		fmt.Printf("❌ Failed to unpack method parameters: %v\n", err)
		return nil, nil, fmt.Errorf("failed to unpack method parameters: %w", err)
	}
	fmt.Printf("✅ Unpacked %d parameters\n", len(params))

	return method, params, nil
}

func (s *Service) GetSourceCode(address string) (map[string]string, error) {
	outputDir := "output/sourceCodeInfos/"

	if !fileExists(outputDir+address+".sol") && !fileExists(outputDir+address+".json") {
		sourceCodeInfo, err := s.etherscanService.GetSourceCodeInfo(address)
		if err != nil {
			// Return placeholder for unverified contracts instead of error
			placeholder := make(map[string]string)
			placeholder["unverified.sol"] = "// No source code available - contract is not verified"
			return placeholder, nil
		}

		err = saveSourceCode(outputDir, sourceCodeInfo, address)
		if err != nil {
			return nil, err
		}

		err = compileContract(outputDir, sourceCodeInfo, address)
		if err != nil {
			return nil, err
		}
	}

	return readSourceCodeFromFile(outputDir, address)
}

func (s *Service) GetSourceMappingAndFileNames(address string) (CompiledContract, error) {
	outputDir := "./output/sourceCodeInfos/"

	if !fileExists(outputDir+address+".sol") && !fileExists(outputDir+address+".json") {
		sourceCodeInfo, err := s.etherscanService.GetSourceCodeInfo(address)
		if err != nil {
			// Return placeholder for unverified contracts instead of error
			placeholder := CompiledContract{
				Srcmap:  "",
				Sources: map[string]string{"0": "unverified.sol"},
			}
			return placeholder, nil
		}

		err = saveSourceCode(outputDir, sourceCodeInfo, address)
		if err != nil {
			return CompiledContract{}, err
		}

		err = compileContract(outputDir, sourceCodeInfo, address)
		if err != nil {
			return CompiledContract{}, err
		}
	}

	return readSourceMappingAndFileIdsFromFile("./output/compiledContracts/", address)
}

func compileContract(outputDir string, info etherscan.SourceCodeInfo, address string) error {
	compilerOutputDir := "output/compiledContracts"
	solcVersion := info.CompilerVersion
	solc := "solc/" + solcVersion

	// make output directory if it doesn't exist
	err := os.MkdirAll(compilerOutputDir, os.ModePerm)
	if err != nil && !os.IsExist(err) {
		return err
	}

	if !info.IsStandardJSON {
		sourceCodeFile := outputDir + address + ".sol"
		cmd := exec.Command(solc, sourceCodeFile, "-o", compilerOutputDir, "--combined-json", "srcmap-runtime")

		// Use the same EVM version as the original compilation
		if info.EVMVersion != "" && strings.ToLower(info.EVMVersion) != "default" {
			cmd.Args = append(cmd.Args, "--evm-version", strings.ToLower(info.EVMVersion))
		}

		if info.OptimizationUsed == "1" {
			cmd.Args = append(cmd.Args, "--optimize")
			if info.Runs != "0" {
				cmd.Args = append(cmd.Args, "--optimize-runs", info.Runs)
			}
		}

		err := cmd.Run()
		if err != nil {
			return err
		}

		oldPath := compilerOutputDir + "/combined.json"
		newPath := compilerOutputDir + "/" + address + ".json"

		err = os.Rename(oldPath, newPath)
		if err != nil {
			return err
		}

		err = formatSingleFileOutput(newPath, info.ContractName, address)
		if err != nil {
			return err
		}

	} else {
		sourceCodeFile := outputDir + address + ".json"
		outputFilePath := compilerOutputDir + "/" + address + ".json"
		cmd := exec.Command(solc, "--standard-json", sourceCodeFile, "-o", compilerOutputDir)

		// For standard JSON, EVM version should be in the JSON, but add it just in case
		if info.EVMVersion != "" && strings.ToLower(info.EVMVersion) != "default" {
			cmd.Args = append(cmd.Args, "--evm-version", strings.ToLower(info.EVMVersion))
		}

		outputFile, err := os.Create(outputFilePath)
		if err != nil {
			return err
		}
		defer outputFile.Close()

		cmd.Stdout = outputFile
		err = cmd.Run()
		if err != nil {
			return err
		}

		err = formatStandardJSONOutput(outputFilePath, info.ContractName)
		if err != nil {
			return err
		}
	}

	return nil
}

func decodeErrorBlob(errorBlob string) (string, error) {
	if errorBlob == "EVM Revert" {
		return errorBlob, nil
	}

	// Decode the revert reason
	revertReasonBytes, err := hex.DecodeString(errorBlob[2:])
	if err != nil {
		return "", err
	}

	// Get the dynamic data length, the 68 byte represent the dynamic data length in the encoded error
	dynamicDataLength := revertReasonBytes[67]

	// Extract the dynamic data (error message)
	errorData := revertReasonBytes[68 : 68+dynamicDataLength]

	// Convert the dynamic data from bytes to string
	errorMessage := string(errorData)

	return errorMessage, nil
}

func formatSingleFileOutput(filePath string, contractName string, address string) error {
	rawData, err := readFile(filePath)
	if err != nil {
		return err
	}

	var singleCompiledContract SingleCompiledContract
	json.Unmarshal(rawData, &singleCompiledContract)

	var compiledContract CompiledContract

	for key, value := range singleCompiledContract.Contracts {
		filePathSplit := strings.Split(key, ":")
		fileName := filePathSplit[len(filePathSplit)-1]
		if fileName == contractName {
			compiledContract.Srcmap = value.Srcmap
		}
	}

	compiledContract.Sources = make(map[string]string)
	compiledContract.Sources["0"] = address + ".sol"

	newJson, err := json.MarshalIndent(compiledContract, "", "    ")
	if err != nil {
		return err
	}

	err = os.WriteFile(filePath, newJson, 0644)
	if err != nil {
		return err
	}

	return nil
}

func formatStandardJSONOutput(filePath string, contractName string) error {
	rawData, err := readFile(filePath)
	if err != nil {
		return err
	}

	var jsonCompiledContract JsonCompiledContract
	json.Unmarshal(rawData, &jsonCompiledContract)

	var compiledContract CompiledContract

	for key, value := range jsonCompiledContract.Contracts {
		filePathSplit := strings.Split(key, "/")
		fileName := filePathSplit[len(filePathSplit)-1]
		if fileName == contractName+".sol" {
			compiledContract.Srcmap = value[contractName].Evm.DeployedBytecode.SourceMap
		}
	}

	compiledContract.Sources = make(map[string]string)
	for key, value := range jsonCompiledContract.Sources {
		compiledContract.Sources[fmt.Sprintf("%v", value.Id)] = key
	}

	newJson, err := json.MarshalIndent(compiledContract, "", "    ")
	if err != nil {
		return err
	}

	err = os.WriteFile(filePath, newJson, 0644)
	if err != nil {
		return err
	}

	return nil
}
