package anvil

import (
	"fmt"
	"os/exec"
)

type anvilService interface {
	StartAnvilProcess(port int, rpcUrl string, blockNumber string) error
	StopAnvilProcess(port int) error
}

type Service struct {
	portToCmdMap map[int]*exec.Cmd
}

func NewService() *Service {
	return &Service{portToCmdMap: make(map[int]*exec.Cmd)}
}

func (s *Service) StartAnvilProcess(port int, rpcUrl string, blockNumber string) error {
	args := []string{"--steps-tracing", "--port", fmt.Sprint(port), "--host", "0.0.0.0", "--fork-url", rpcUrl}
	
	// Add block number flag if specified
	if blockNumber != "" {
		args = append(args, "--fork-block-number", blockNumber)
	}
	
	cmd := exec.Command("anvil", args...)
	err := cmd.Start()
	if err != nil {
		return err
	}

	s.portToCmdMap[port] = cmd
	return nil
}

func (s *Service) StopAnvilProcess(port int) error {
	cmd := s.portToCmdMap[port]

	err := cmd.Process.Kill()
	if err != nil {
		return err
	}

	delete(s.portToCmdMap, port)
	return nil
}
