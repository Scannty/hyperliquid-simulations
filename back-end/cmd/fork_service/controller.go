package main

import (
	balance "Simulations/src/balance"
	"Simulations/src/debug"
	"Simulations/src/fork"
	evm "Simulations/src/rpc"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strconv"

	"github.com/labstack/echo"
)

type HTTPError struct {
	Message string `json:"message"`
	Status  int    `json:"status"`
}

type Controller struct {
	forkService    *fork.Service
	evmService     *evm.Service
	balanceService *balance.Service
	debugService   *debug.Service
}

func NewController(forkService *fork.Service, evmService *evm.Service, balanceService *balance.Service, debugService *debug.Service) *Controller {
	return &Controller{
		forkService:    forkService,
		evmService:     evmService,
		balanceService: balanceService,
		debugService:   debugService,
	}
}

func (ctrl *Controller) createForkHandler(c echo.Context) error {
	forkDuration := c.QueryParam("forkDuration")

	if forkDuration == "" {
		forkDuration = "30"
	}

	forkDurationMins, err := strconv.Atoi(forkDuration)
	if err != nil {
		httpError := HTTPError{
			Message: "Invalid fork duration",
			Status:  http.StatusBadRequest,
		}

		return c.JSON(http.StatusBadRequest, httpError)
	}

	forkId, err := ctrl.forkService.CreateFork(forkDurationMins)
	if err != nil {
		httpError := HTTPError{
			Message: "Fork creation failed",
			Status:  http.StatusInternalServerError,
		}

		return c.JSON(http.StatusBadRequest, httpError)
	}

	res := map[string]string{
		"forkId": forkId,
		"rpcUrl": fmt.Sprintf("http://%v/fork/rpc/%v", c.Request().Host, forkId),
	}

	return c.JSON(http.StatusCreated, res)
}

func (ctrl *Controller) deleteForkHandler(c echo.Context) error {
	forkId := c.Param("forkId")

	err := ctrl.forkService.DeleteFork(forkId)
	if err != nil {
		httpError := HTTPError{
			Message: "Fork creation failed",
			Status:  http.StatusInternalServerError,
		}

		return c.JSON(http.StatusInternalServerError, httpError)
	}

	return c.JSON(http.StatusOK, fmt.Sprintf("Successfully deleted fork: %v", forkId))
}

func (ctrl *Controller) rpcRequestHandler(c echo.Context) error {
	forkId := c.Param("forkId")

	rawData, err := io.ReadAll(c.Request().Body)
	if err != nil {
		httpError := HTTPError{
			Message: "Bad request format",
			Status:  http.StatusBadRequest,
		}

		return c.JSON(http.StatusBadRequest, httpError)
	}

	statusCode, resData, err := ctrl.evmService.SendRpcRequest(forkId, rawData)
	if err != nil {
		httpError := HTTPError{
			Message: "Error forwarding request",
			Status:  http.StatusInternalServerError,
		}

		return c.JSON(http.StatusInternalServerError, httpError)
	}

	return c.String(statusCode, string(resData))
}

func (ctrl *Controller) getBalanceHandler(c echo.Context) error {
	forkId := c.Param("forkId")
	address := c.QueryParam("address")

	statusCode, balanceHex, err := ctrl.evmService.GetBalance(forkId, address)
	if err != nil {
		httpError := HTTPError{
			Message: "Error getting balance",
			Status:  statusCode,
		}

		return c.JSON(statusCode, httpError)
	}

	balance := new(big.Int)
	_, success := balance.SetString(balanceHex[2:], 16)
	if !success {
		httpError := HTTPError{
			Message: "Error parsing balance",
			Status:  http.StatusInternalServerError,
		}

		return c.JSON(http.StatusInternalServerError, httpError)
	}

	return c.JSON(statusCode, balance)
}

func (ctrl *Controller) setBalanceHandler(c echo.Context) error {
	forkId := c.Param("forkId")
	address := c.QueryParam("address")
	balance := c.QueryParam("balance")

	statusCode, err := ctrl.evmService.SetBalance(forkId, address, balance)
	if err != nil {
		httpError := HTTPError{
			Message: "Error setting balance",
			Status:  statusCode,
		}

		return c.JSON(statusCode, httpError)
	}

	return c.JSON(statusCode, "Balance changed successfully!")
}

func (ctrl *Controller) getERC20BalanceHandler(c echo.Context) error {
	forkId := c.Param("forkId")
	userAddress := c.QueryParam("address")
	tokenAddress := c.QueryParam("tokenAddress")

	balance, err := ctrl.balanceService.GetERC20Balance(forkId, tokenAddress, userAddress)
	if err != nil {
		httpError := HTTPError{
			Message: "Error getting ERC20 balance",
			Status:  http.StatusInternalServerError,
		}

		return c.JSON(http.StatusInternalServerError, httpError)
	}

	return c.JSON(http.StatusOK, balance)
}

func (ctrl *Controller) setERC20BalanceHandler(c echo.Context) error {
	forkId := c.Param("forkId")
	userAddress := c.QueryParam("address")
	tokenAddress := c.QueryParam("tokenAddress")
	balance := c.QueryParam("balance")

	err := ctrl.balanceService.SetERC20Balance(forkId, userAddress, tokenAddress, balance)
	if err != nil {
		httpError := HTTPError{
			Message: "Error setting ERC20 balance",
			Status:  http.StatusInternalServerError,
		}

		return c.JSON(http.StatusInternalServerError, httpError)
	}

	return c.JSON(http.StatusOK, "Balance successfully changed to: "+balance)
}

func (ctrl *Controller) getSourceCode(c echo.Context) error {
	contractAddress := c.QueryParam("contractAddress")

	codeFiles, err := ctrl.debugService.GetSourceCode(contractAddress)
	if err != nil {
		httpError := HTTPError{
			Message: "Error getting source code",
			Status:  http.StatusInternalServerError,
		}

		return c.JSON(http.StatusInternalServerError, httpError)
	}

	return c.JSON(http.StatusOK, codeFiles)
}

func (ctrl *Controller) getContractsCalledHandler(c echo.Context) error {
	forkId := c.Param("forkId")
	txHash := c.QueryParam("txHash")

	traces, err := ctrl.debugService.GetContractsCalled(forkId, txHash)
	if err != nil {
		httpError := HTTPError{
			Message: "Error getting contracts called",
			Status:  http.StatusInternalServerError,
		}

		return c.JSON(http.StatusInternalServerError, httpError)
	}

	return c.JSON(http.StatusOK, traces)
}

func (ctrl *Controller) debugTransactionCallTraceHandler(c echo.Context) error {
	forkId := c.Param("forkId")
	txHash := c.QueryParam("txHash")

	errorLineNumber, errorMessage, debugCallTrace, err := ctrl.debugService.DebugTransaction(forkId, txHash)
	if err != nil {
		httpError := HTTPError{
			Message: "Error debugging transaction",
			Status:  http.StatusInternalServerError,
		}

		return c.JSON(http.StatusInternalServerError, httpError)
	}

	res := struct {
		RevertReason string
		LineNumber   int
		DebugTrace   []debug.CallTrace
	}{
		RevertReason: errorMessage,
		LineNumber:   errorLineNumber,
		DebugTrace:   debugCallTrace,
	}

	return c.JSON(http.StatusOK, res)
}

func (ctrl *Controller) simulateRawTxHandler(c echo.Context) error {
	rawData, err := io.ReadAll(c.Request().Body)
	if err != nil {
		httpError := HTTPError{
			Message: "Bad request format",
			Status:  http.StatusBadRequest,
		}

		return c.JSON(http.StatusBadRequest, httpError)
	}

	contractsCalled, errorLineNumber, revertReason, debugTrace, err := ctrl.debugService.SimulateRawTransaction(rawData)
	if err != nil {
		htppError := HTTPError{
			Message: "Error simulating raw transaction",
			Status:  http.StatusInternalServerError,
		}

		return c.JSON(http.StatusInternalServerError, htppError)
	}

	res := struct {
		ContractsCalled []debug.ContractCalled
		LineNumber   int
		RevertReason string
		DebugTrace   []debug.CallTrace
	}{
		ContractsCalled: contractsCalled,
		LineNumber:   errorLineNumber,
		RevertReason: revertReason,
		DebugTrace:   debugTrace,
	}

	return c.JSON(http.StatusOK, res)
}
