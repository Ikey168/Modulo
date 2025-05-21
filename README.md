# Modulo Java

A multi-module Java 21 project that combines frontend, backend, and smart contract capabilities.

## Project Structure

- `frontend/` - Frontend module
- `backend/` - Spring Boot backend service
- `smart-contracts/` - Blockchain smart contracts using Web3j

## Requirements

- Java 21 or higher
- Maven 3.9+ or higher

## Building

To build all modules:

```bash
mvn clean install
```

## Running

### Backend

```bash
cd backend
mvn spring-boot:run
```

### Frontend

```bash
cd frontend
mvn exec:java
```

### Smart Contracts

```bash
cd smart-contracts
mvn exec:java
```

## Development

Each module can be developed independently:

- Frontend: Java-based frontend application
- Backend: Spring Boot REST API service
- Smart Contracts: Web3j-based smart contract implementations

## Testing

To run tests for all modules:

```bash
mvn test
```

Or for a specific module:

```bash
mvn test -pl frontend
mvn test -pl backend
mvn test -pl smart-contracts
