package dbRepo

import (
	"errors"

	"github.com/hashicorp/go-memdb"
	log "github.com/sirupsen/logrus"
)

type port struct {
	PortNumber int
	Active     bool
	ForkId     string
}

type Repository struct {
	db  *memdb.MemDB
	txn *memdb.Txn
}

func (repo *Repository) Init() error {
	schema := &memdb.DBSchema{
		Tables: map[string]*memdb.TableSchema{
			"port": {
				Name: "port",
				Indexes: map[string]*memdb.IndexSchema{
					"id": {
						Name:    "id",
						Unique:  true,
						Indexer: &memdb.IntFieldIndex{Field: "PortNumber"},
					},
					"active": {
						Name:    "active",
						Unique:  false,
						Indexer: &memdb.BoolFieldIndex{Field: "Active"},
					},
					"forkId": {
						Name:    "forkId",
						Unique:  true,
						Indexer: &memdb.StringFieldIndex{Field: "ForkId"},
					},
				},
			},
		},
	}

	var err error
	repo.db, err = memdb.NewMemDB(schema)
	if err != nil {
		return err
	}

	return nil
}

func (repo *Repository) InsertPort(portNumber int, active bool, forkId string) error {
	txn := repo.db.Txn(true)
	defer txn.Commit()

	port := &port{
		PortNumber: portNumber,
		Active:     active,
		ForkId:     forkId,
	}

	if err := txn.Insert("port", port); err != nil {
		return err
	}

	return nil
}

func (repo *Repository) FindInactivePort() (int, error) {
	txn := repo.db.Txn(false)

	it, err := txn.Get("port", "id")
	if err != nil {
		log.Error("Database error when finding port!")
		return 0, err
	}

	for obj := it.Next(); obj != nil; obj = it.Next() {
		port := obj.(*port)
		if !port.Active {
			return port.PortNumber, nil
		}
	}

	log.Error("No available port!")
	return 0, errors.New("no available port")
}

func (repo *Repository) UpdatePort(portNumber int, active bool, forkId string) error {
	txn := repo.db.Txn(true)
	defer txn.Commit()

	it, err := txn.Get("port", "id")
	if err != nil {
		log.Error("Database error when finding port!")
		return err
	}

	for obj := it.Next(); obj != nil; obj = it.Next() {
		port := obj.(*port)
		if port.PortNumber == portNumber {
			port.Active = active
			port.ForkId = forkId
			return nil
		}
	}

	log.Errorf("Port %v doesn't exist!", portNumber)
	return errors.New("port doesn't exist")
}

func (repo *Repository) FindPortByForkId(forkId string) (int, error) {
	txn := repo.db.Txn(false)

	it, err := txn.Get("port", "forkId")
	if err != nil {
		log.Error("Database error when finding port!")
		return 0, err
	}

	for obj := it.Next(); obj != nil; obj = it.Next() {
		port := obj.(*port)
		if port.ForkId == forkId {
			return port.PortNumber, nil
		}
	}

	return 0, errors.New("port doesn't exist")
}

func (repo *Repository) FindPortStatusByForkId(forkId string) (bool, error) {
	txn := repo.db.Txn(false)

	it, err := txn.Get("port", "forkId")
	if err != nil {
		log.Error("Database error when finding port!")
		return false, err
	}

	for obj := it.Next(); obj != nil; obj = it.Next() {
		port := obj.(*port)
		if port.ForkId == forkId {
			return port.Active, nil
		}
	}

	log.Errorf("No port with fork %v!", forkId)
	return false, errors.New("port doesn't exist")
}
