package debug

import (
	"Simulations/src/etherscan"
	"encoding/json"
	"io"
	"os"
	"strconv"
	"strings"
)

func decompressSourceMap(sourceMap string) []Opcode {
	opcodes := strings.Split(sourceMap, ";")

	var prevOpcode Opcode
	var currOpcode Opcode
	var decompressedSourceMap []Opcode

	for _, opcode := range opcodes {
		opcodeEntries := strings.Split(opcode, ":")

		switch len(opcodeEntries) {
		case 1:
			currOpcode = Opcode{
				Offset:        opcodeEntries[0],
				Length:        prevOpcode.Length,
				FileID:        prevOpcode.FileID,
				JumpType:      prevOpcode.JumpType,
				ModifierDepth: prevOpcode.ModifierDepth,
			}
		case 2:
			currOpcode = Opcode{
				Offset:        opcodeEntries[0],
				Length:        opcodeEntries[1],
				FileID:        prevOpcode.FileID,
				JumpType:      prevOpcode.JumpType,
				ModifierDepth: prevOpcode.ModifierDepth,
			}
		case 3:
			currOpcode = Opcode{
				Offset:        opcodeEntries[0],
				Length:        opcodeEntries[1],
				FileID:        opcodeEntries[2],
				JumpType:      prevOpcode.JumpType,
				ModifierDepth: prevOpcode.ModifierDepth,
			}
		case 4:
			currOpcode = Opcode{
				Offset:        opcodeEntries[0],
				Length:        opcodeEntries[1],
				FileID:        opcodeEntries[2],
				JumpType:      opcodeEntries[3],
				ModifierDepth: prevOpcode.ModifierDepth,
			}
		case 5:
			currOpcode = Opcode{
				Offset:        opcodeEntries[0],
				Length:        opcodeEntries[1],
				FileID:        opcodeEntries[2],
				JumpType:      opcodeEntries[3],
				ModifierDepth: opcodeEntries[4],
			}
		}

		removeBlankSpaces(&currOpcode, prevOpcode)
		decompressedSourceMap = append(decompressedSourceMap, currOpcode)

		prevOpcode = currOpcode
	}
	return decompressedSourceMap
}

func getLineNumber(sourceCode []byte, bytesOffset string) (int, error) {
	bytesOffsetInt, err := strconv.Atoi(bytesOffset)
	if err != nil {
		return 0, err
	}

	relevantCode := string(sourceCode[:bytesOffsetInt])

	lineNumber := len(strings.Split(relevantCode, "\n"))

	return lineNumber, nil
}

func removeBlankSpaces(currOpcode *Opcode, prevOpcode Opcode) {
	if currOpcode.Offset == "" {
		currOpcode.Offset = prevOpcode.Offset
	}
	if currOpcode.Length == "" {
		currOpcode.Length = prevOpcode.Length
	}
	if currOpcode.FileID == "" {
		currOpcode.FileID = prevOpcode.FileID
	}
	if currOpcode.JumpType == "" {
		currOpcode.JumpType = prevOpcode.JumpType
	}
}

func saveSourceCode(outputDir string, sourceCodeInfo etherscan.SourceCodeInfo, address string) error {
	// make output directory if it doesn't exist
	err := os.MkdirAll(outputDir, os.ModePerm)
	if err != nil && !os.IsExist(err) {
		return err
	}

	var fileExtension string
	if sourceCodeInfo.IsStandardJSON {
		fileExtension = ".json"
	} else {
		fileExtension = ".sol"
	}

	file, err := os.Create(outputDir + address + fileExtension)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = file.WriteString(sourceCodeInfo.SourceCode)
	if err != nil {
		return err
	}

	return nil
}

func readSourceCodeFromFile(outputDir string, address string) (map[string]string, error) {
	standardJSONFilePath := outputDir + address + ".json"
	fileMap := make(map[string]string)

	if fileExists(standardJSONFilePath) {
		rawData, err := readFile(standardJSONFilePath)
		if err != nil {
			return nil, err
		}

		var standardJsonInput StandardJsonInput
		err = json.Unmarshal(rawData, &standardJsonInput)
		if err != nil {
			return nil, err
		}

		for fileName, inputFile := range standardJsonInput.Sources {
			fileMap[fileName] = inputFile.Content
		}

	} else {
		sourceCode, err := readFile(outputDir + address + ".sol")
		if err != nil {
			return nil, err
		}

		fileMap[address+".sol"] = string(sourceCode)
	}

	return fileMap, nil
}

func readSourceMappingAndFileIdsFromFile(outputDir string, address string) (CompiledContract, error) {
	rawData, err := readFile(outputDir + address + ".json")
	if err != nil {
		return CompiledContract{}, nil
	}

	var compiledContract CompiledContract
	err = json.Unmarshal(rawData, &compiledContract)
	if err != nil {
		return CompiledContract{}, err
	}

	return compiledContract, nil
}

func fileExists(sourceCodeFile string) bool {
	fileInfo, err := os.Stat(sourceCodeFile)
	if !os.IsNotExist(err) && !fileInfo.IsDir() {
		return true
	}

	return false
}

func readFile(filePath string) ([]byte, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	bytes, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}

	return bytes, nil
}

func fileIdValid(fileId string, fileIds map[string]string) bool {
	fileIdNum, err := strconv.Atoi(fileId)
	if err != nil {
		return false
	}

	return fileIdNum < len(fileIds) && fileIdNum >= 0
}
