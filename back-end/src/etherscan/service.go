package etherscan

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/pkg/errors"
)

type Service struct {
	etherscanApiKey string
}

type EtherScanService interface {
	GetSourceCodeInfo(address string) (SourceCodeInfo, error)
	GetAbi(address string) (string, error)
}

func NewService(etherscanApiKey string) *Service {
	return &Service{
		etherscanApiKey: etherscanApiKey,
	}
}

func (s *Service) GetSourceCodeInfo(address string) (SourceCodeInfo, error) {
	var info SourceCodeInfo
	var err error

	for {
		info, err = s.getSourceCodeInfo(address)
		if err != nil {
			if err.Error() == "Max rate limit reached" {
				time.Sleep(500 * time.Millisecond)
				continue
			}
			return SourceCodeInfo{}, err
		}
		break
	}

	return info, nil
}

func (s *Service) getSourceCodeInfo(address string) (SourceCodeInfo, error) {
	url := "https://api.etherscan.io/v2/api" +
		"?chainid=999" +
		"&module=contract" +
		"&action=getsourcecode" +
		"&address=" + address +
		"&apikey=" + s.etherscanApiKey

	resp, err := http.Get(url)
	if err != nil {
		return SourceCodeInfo{}, err
	}

	resData, err := io.ReadAll(resp.Body)
	if err != nil {
		return SourceCodeInfo{}, err
	}

	var sourceCodeRes SourceCodeResponse
	err = json.Unmarshal(resData, &sourceCodeRes)
	if err != nil {
		var errorRes ErrorResponse
		err = json.Unmarshal(resData, &errorRes)
		if err != nil {
			return SourceCodeInfo{}, err
		}

		return SourceCodeInfo{}, errors.New(errorRes.Result)
	}

	if sourceCodeRes.Status != "1" || sourceCodeRes.Message != "OK" || len(sourceCodeRes.Result[0].SourceCode) == 0 {
		return SourceCodeInfo{}, errors.New("failed to get source code")
	}

	// Remove the first and last curly braces if the source code is standard JSON
	sourceCode := sourceCodeRes.Result[0].SourceCode
	isStandardJSON := false
	if sourceCode[0] == '{' {
		sourceCode = sourceCode[1 : len(sourceCode)-1]
		isStandardJSON = true
	}

	info := SourceCodeInfo{
		SourceCode:       sourceCode,
		ContractName:     sourceCodeRes.Result[0].ContractName,
		OptimizationUsed: sourceCodeRes.Result[0].OptimizationUsed,
		CompilerVersion:  sourceCodeRes.Result[0].CompilerVersion,
		Runs:             sourceCodeRes.Result[0].Runs,
		EVMVersion:       sourceCodeRes.Result[0].EVMVersion,
		IsStandardJSON:   isStandardJSON,
	}

	return info, nil
}

func (s *Service) GetAbi(address string) (string, error) {
	var abi string
	var err error

	for {
		abi, err = s.getAbi(address)
		if err != nil {
			if err.Error() == "Max rate limit reached" {
				time.Sleep(500 * time.Millisecond)
				continue
			}
			return "", err
		}
		break
	}

	return abi, nil
}

func (s *Service) getAbi(address string) (string, error) {
	url := "https://api.etherscan.io/v2/api" +
		"?chainid=999" +
		"&module=contract" +
		"&action=getabi" +
		"&address=" + address +
		"&apikey=" + s.etherscanApiKey

	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}

	resData, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var abiRes AbiResponse
	err = json.Unmarshal(resData, &abiRes)
	if err != nil {
		return "", err
	}

	if abiRes.Status != "1" || abiRes.Message != "OK" {
		return "", errors.New(abiRes.Result)
	}

	return abiRes.Result, nil
}
