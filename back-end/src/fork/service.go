package fork

import (
	"bytes"
	"fmt"
	"net/http"
	"time"

	"github.com/pkg/errors"
	log "github.com/sirupsen/logrus"
)

type repository interface {
	AllocatePorts(ports []int)
	FindAndReservePort() (portNumber int, forkId string, err error)
	ReleasePortWithForkId(forkId string) error
	GetPortWithForkId(forkId string) (int, error)
	IsPortActive(forkId string) (bool, error)
}

type anvilService interface {
	StartAnvilProcess(port int, rpcUrl string) error
	StopAnvilProcess(port int) error
}

type Service struct {
	repo         repository
	anvilService anvilService
	rpcUrl       string
}

func NewService(repo repository, anvilService anvilService, rpcUrl string) *Service {
	return &Service{repo: repo, anvilService: anvilService, rpcUrl: rpcUrl}
}

func (s *Service) AllocatePorts(ports []int) {
	s.repo.AllocatePorts(ports)
}

func (s *Service) CreateFork(forkDuration int) (string, error) {
	port, forkId, err := s.repo.FindAndReservePort()
	if err != nil {
		return "", err
	}

	err = s.anvilService.StartAnvilProcess(port, s.rpcUrl)
	if err != nil {
		releaseErr := s.repo.ReleasePortWithForkId(forkId)
		if releaseErr != nil {
			log.Error("Failed releasing reserved port!")
			return "", errors.Wrap(err, releaseErr.Error())
		}

		log.Error("Fork creation failed!")
		return "", err
	}

	// Delete fork after provided duration
	go func() {
		time.Sleep(time.Duration(forkDuration) * time.Minute)
		err := s.DeleteFork(forkId)
		if err != nil {
			log.Error(err)
		}
	}()

	log.Infof("Created fork with id: %v.", forkId)
	return forkId, nil
}

func (s *Service) DeleteFork(forkId string) error {
	port, err := s.repo.GetPortWithForkId(forkId)
	if err != nil {
		log.Error(err.Error())
		return err
	}

	portStatus, err := s.repo.IsPortActive(forkId)
	if err != nil {
		log.Error(err.Error())
		return err
	}

	if !portStatus {
		log.Errorf("Fork %v is not active!", forkId)
		return errors.New("fork is not active")
	}

	err = s.anvilService.StopAnvilProcess(port)
	if err != nil {
		log.Error("Couldn't terminate fork!")
		return err
	}

	err = s.repo.ReleasePortWithForkId(forkId)
	if err != nil {
		return err
	}

	log.Infof("Deleted fork with id: %v.", forkId)
	return nil
}

func (s *Service) ForwardRpcRequest(forkId string, rawData []byte) (*http.Response, error) {
	port, err := s.repo.GetPortWithForkId(forkId)
	if err != nil {
		return nil, err
	}

	portStatus, err := s.repo.IsPortActive(forkId)
	if err != nil {
		log.Error(err.Error())
		return nil, err
	}

	if !portStatus {
		return nil, errors.New("Fork is inactive: " + forkId)
	}

	url := "http://0.0.0.0:" + fmt.Sprint(port)
	res, err := http.Post(url, "application/json", bytes.NewBuffer(rawData))

	if err != nil {
		log.Error("There was a problem with forwarding the RPC request!")
		return nil, err
	}

	return res, nil
}
