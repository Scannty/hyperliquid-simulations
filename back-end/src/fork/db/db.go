package db

import (
	"sync"

	"github.com/google/uuid"
	log "github.com/sirupsen/logrus"
)

type dbRepoInterface interface {
	InsertPort(portNumber int, active bool, forkId string) error
	FindInactivePort() (int, error)
	UpdatePort(portNumber int, active bool, forkId string) error
	FindPortByForkId(forkId string) (int, error)
	FindPortStatusByForkId(forkId string) (bool, error)
}

type repository interface {
	AllocatePorts(ports []int)
	FindAndReservePort() (portNumber int, forkId string, err error)
	ReleasePortWithForkId(forkId string) error
	GetPortWithForkId(forkId string) (int, error)
	IsPortActive(forkId string) (bool, error)
}

type Repository struct {
	dbRepo dbRepoInterface
	mutex  sync.Mutex
}

func NewRepository(dbRepo dbRepoInterface) *Repository {
	rep := &Repository{dbRepo: dbRepo}
	return rep
}

func (repo *Repository) AllocatePorts(ports []int) {
	for _, portNumber := range ports {
		err := repo.dbRepo.InsertPort(portNumber, false, uuid.New().String())
		if err != nil {
			log.Errorf("Failed allocating port %v.", portNumber)
		}
	}
}

func (repo *Repository) FindAndReservePort() (portNumber int, forkId string, err error) {
	repo.mutex.Lock()
	defer repo.mutex.Unlock()

	port, err := repo.dbRepo.FindInactivePort()
	if err != nil {
		return 0, "", err
	}

	newForkId := uuid.New().String()
	err = repo.dbRepo.UpdatePort(port, true, newForkId)
	if err != nil {
		return 0, "", err
	}

	log.Infof("Allocated port %v to fork %v.", port, newForkId)
	return port, newForkId, nil
}

func (repo *Repository) ReleasePortWithForkId(forkId string) error {
	port, err := repo.dbRepo.FindPortByForkId(forkId)
	if err != nil {
		return err
	}

	err = repo.dbRepo.UpdatePort(port, false, forkId)
	if err != nil {
		return err
	}

	log.Infof("Released port %v from fork %v.", port, forkId)
	return nil
}

func (repo *Repository) GetPortWithForkId(forkId string) (int, error) {
	port, err := repo.dbRepo.FindPortByForkId(forkId)
	if err != nil {
		return 0, err
	}

	return port, nil
}

func (repo *Repository) IsPortActive(forkId string) (bool, error) {
	status, err := repo.dbRepo.FindPortStatusByForkId(forkId)
	if err != nil {
		return false, err
	}

	return status, nil
}
