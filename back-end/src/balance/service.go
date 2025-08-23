package balance

import (
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"golang.org/x/crypto/sha3"
)

type evmService interface {
	GetCurrentSnapshot(forkId string) (string, error)
	ChangeStorageSlot(forkId, tokenAddress, value, slot string) error
	RevertState(forkId, snapshot string) error
	SendCallTransaction(forkId, tokenAddress, funcEncoded string) (string, error)
}

type Service struct {
	evmService evmService
}

func NewService(evmService evmService) *Service {
	return &Service{
		evmService: evmService,
	}
}

func (s *Service) SetERC20Balance(forkId, userAddress, tokenAddress, balance string) error {
	for slotNumber := 0; slotNumber < 100; slotNumber++ {
		snapshot, err := s.evmService.GetCurrentSnapshot(forkId)
		if err != nil {
			return err
		}

		balanceSlot, err := getSlot(userAddress, slotNumber)
		if err != nil {
			return err
		}

		err = s.evmService.ChangeStorageSlot(forkId, tokenAddress, balance, balanceSlot)
		if err != nil {
			return err
		}

		currBalance, err := s.GetERC20Balance(forkId, tokenAddress, userAddress)
		if err != nil {
			return err
		}

		if currBalance == balance {
			return nil
		}

		errRevert := s.evmService.RevertState(forkId, snapshot)
		if errRevert != nil {
			return err
		}
	}

	return fmt.Errorf("Mapping slot for given address not found!")
}

func (s *Service) GetERC20Balance(forkId, tokenAddress, userAddress string) (string, error) {
	funcEncoded := encodeBalanceOf(userAddress)

	balance, err := s.evmService.SendCallTransaction(forkId, tokenAddress, funcEncoded)
	if err != nil {
		return "", err
	}

	return balance, nil
}

func getSlot(account string, slotNumber int) (string, error) {
	// Trim the 0x from account
	account = strings.TrimPrefix(account, "0x")

	// Pad the address with zeros on the left
	paddedAddress := fmt.Sprintf("%064s", account)

	concatenated := paddedAddress + fmt.Sprintf("%064v", slotNumber)

	// Decode the hex string to raw bytes
	data, err := hex.DecodeString(concatenated)
	if err != nil {
		return "", err
	}

	hashFunc := sha3.NewLegacyKeccak256()
	hashFunc.Write(data)
	hashed := hashFunc.Sum(nil)

	// // Return the hash as a hexadecimal string
	return "0x" + hex.EncodeToString(hashed), nil
}

func encodeBalanceOf(userAddress string) string {
	funcSignature := "balanceOf(address)"

	hash := sha3.NewLegacyKeccak256()
	hash.Write([]byte(funcSignature))
	functionSelector := hash.Sum(nil)[:4]

	encodedData := append(functionSelector, common.LeftPadBytes(common.HexToAddress(userAddress).Bytes(), 32)...)

	return hex.EncodeToString(encodedData)
}
