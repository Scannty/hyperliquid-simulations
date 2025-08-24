package main

import (
	"Simulations/src/anvil"
	balance "Simulations/src/balance"
	"Simulations/src/debug"
	"Simulations/src/etherscan"
	"Simulations/src/fork"
	"Simulations/src/fork/db"
	"Simulations/src/fork/dbRepo"
	evm "Simulations/src/rpc"

	"os"
	"strconv"

	"github.com/joho/godotenv"
	"github.com/labstack/echo"
	"github.com/labstack/echo/middleware"

	"strings"
)

func main() {
	if godotenv.Load() != nil {
		panic("Failed loading .env file!")
	}

	portsArg := os.Getenv("PORTS")
	rpcUrl := os.Getenv("RPC_URL")
	etherScanApiKey := os.Getenv("ETHERSCAN_API_KEY")

	dbRepository := &dbRepo.Repository{}
	err := dbRepository.Init()
	if err != nil {
		panic(err)
	}

	repo := db.NewRepository(dbRepository)

	anvilService := anvil.NewService()
	forkService := fork.NewService(repo, anvilService, rpcUrl)
	forkService.AllocatePorts(parsePorts(portsArg))

	evmService := evm.NewService(forkService)
	balanceService := balance.NewService(evmService)
	etherscanService := etherscan.NewService(etherScanApiKey)
	debugService := debug.NewService(forkService, etherscanService, evmService)

	ctrl := NewController(forkService, evmService, balanceService, debugService)
	e := echo.New()

	e.Use(middleware.CORS())

	e.POST("/fork", ctrl.createForkHandler)
	e.DELETE("/fork/:forkId", ctrl.deleteForkHandler)
	e.POST("/fork/rpc/:forkId", ctrl.rpcRequestHandler)

	e.POST("/fork/getBalance/:forkId", ctrl.getBalanceHandler)
	e.POST("/fork/setBalance/:forkId", ctrl.setBalanceHandler)
	e.POST("/fork/getERC20Balance/:forkId", ctrl.getERC20BalanceHandler)
	e.POST("/fork/setERC20Balance/:forkId", ctrl.setERC20BalanceHandler)

	e.GET("/debug/getSourceCode", ctrl.getSourceCode)
	e.GET("/debug/contractsCalled/:forkId", ctrl.getContractsCalledHandler)
	e.GET("/debug/debugTransaction/:forkId", ctrl.debugTransactionCallTraceHandler)

	e.POST("/simulate/simulateRawTx", ctrl.simulateRawTxHandler)

	// Start the server
	e.Logger.Fatal(e.Start(":8080"))
}

func parsePorts(portsArg string) []int {
	var ports []int

	for _, port := range strings.Split(portsArg, ",") {
		portNumber, err := strconv.ParseInt(port, 10, 64)
		if err != nil {
			panic("Bad port environment variable!")
		}

		ports = append(ports, int(portNumber))
	}

	return ports
}
