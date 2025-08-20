package com.modulo.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.http.HttpService;
import org.web3j.tx.gas.DefaultGasProvider;
import org.web3j.tx.gas.StaticGasProvider;

import java.math.BigInteger;

/**
 * Configuration for blockchain connectivity using web3j
 */
@Slf4j
@Configuration
public class BlockchainConfig {

    @Value("${blockchain.network.rpc-url:https://rpc-mumbai.maticvigil.com}")
    private String rpcUrl;

    @Value("${blockchain.network.chain-id:80001}")
    private long chainId;

    @Value("${blockchain.contract.note-registry-address:}")
    private String noteRegistryAddress;

    @Value("${blockchain.contract.modulo-token-address:}")
    private String moduloTokenAddress;

    @Value("${blockchain.contract.note-monetization-address:}")
    private String noteMonetizationAddress;

    @Value("${blockchain.private-key:}")
    private String privateKey;

    @Value("${blockchain.gas.price:20000000000}")
    private BigInteger gasPrice;

    @Value("${blockchain.gas.limit:3000000}")
    private BigInteger gasLimit;

    /**
     * Web3j client for blockchain interaction
     */
    @Bean
    public Web3j web3j() {
        log.info("Configuring Web3j client for RPC URL: {}", rpcUrl);
        log.info("Chain ID: {}, NoteRegistry Address: {}", chainId, noteRegistryAddress);
        
        try {
            Web3j web3j = Web3j.build(new HttpService(rpcUrl));
            
            // Test the connection
            web3j.ethBlockNumber().send().getBlockNumber();
            log.info("✅ Successfully connected to blockchain network");
            
            return web3j;
        } catch (Exception e) {
            log.error("❌ Failed to connect to blockchain network: {}", e.getMessage());
            log.warn("Creating mock Web3j client - operations will use placeholder mode");
            // Return a mock Web3j that doesn't actually connect
            return Web3j.build(new HttpService("http://127.0.0.1:1"));
        }
    }

    /**
     * Credentials for blockchain transactions
     */
    @Bean
    public Credentials credentials() {
        if (privateKey == null || privateKey.isEmpty()) {
            log.warn("No private key configured - using dummy credentials for testing");
            // Create dummy credentials for testing/offline mode
            return Credentials.create("0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01");
        }
        
        try {
            Credentials credentials = Credentials.create(privateKey);
            log.info("✅ Blockchain credentials configured for address: {}", credentials.getAddress());
            return credentials;
        } catch (Exception e) {
            log.error("❌ Failed to create credentials from private key: {}", e.getMessage());
            log.warn("Using dummy credentials for testing");
            return Credentials.create("0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01");
        }
    }

    /**
     * Gas provider for transactions
     */
    @Bean
    public StaticGasProvider gasProvider() {
        return new StaticGasProvider(gasPrice, gasLimit);
    }

    /**
     * Get the configured RPC URL
     */
    public String getRpcUrl() {
        return rpcUrl;
    }

    /**
     * Get the configured chain ID
     */
    public long getChainId() {
        return chainId;
    }

    /**
     * Get the configured NoteRegistry contract address
     */
    public String getNoteRegistryAddress() {
        return noteRegistryAddress;
    }

    /**
     * Get the configured ModuloToken contract address
     */
    public String getModuloTokenAddress() {
        return moduloTokenAddress;
    }

    /**
     * Get the configured NoteMonetization contract address
     */
    public String getNoteMonetizationAddress() {
        return noteMonetizationAddress;
    }
}
