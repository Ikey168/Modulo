package com.modulo.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.http.HttpService;
import org.web3j.tx.gas.DefaultGasProvider;
import org.web3j.tx.gas.StaticGasProvider;

import java.math.BigInteger;

/**
 * Configuration class for Web3j blockchain integration
 * Provides beans for Web3j client, credentials, and gas providers
 */
@Configuration
public class BlockchainConfig {

    @Value("${blockchain.rpc.url}")
    private String rpcUrl;

    @Value("${blockchain.private.key:#{null}}")
    private String privateKey;

    @Value("${blockchain.contract.address:}")
    private String contractAddress;

    @Value("${blockchain.gas.price:20000000000}")
    private BigInteger gasPrice;

    @Value("${blockchain.gas.limit:3000000}")
    private BigInteger gasLimit;

    @Value("${blockchain.network.name:localhost}")
    private String networkName;

    /**
     * Creates Web3j client for blockchain interaction
     */
    @Bean
    public Web3j web3j() {
        return Web3j.build(new HttpService(rpcUrl));
    }

    /**
     * Creates credentials from private key for transaction signing
     * Only available when private key is configured
     */
    @Bean
    @Profile("!test")
    public Credentials credentials() {
        if (privateKey == null || privateKey.isEmpty()) {
            throw new IllegalStateException(
                "Private key not configured. Set blockchain.private.key property."
            );
        }
        
        // Remove 0x prefix if present
        String cleanPrivateKey = privateKey.startsWith("0x") ? 
            privateKey.substring(2) : privateKey;
            
        return Credentials.create(cleanPrivateKey);
    }

    /**
     * Creates gas provider with configured gas price and limit
     * Uses static values for predictable gas costs
     */
    @Bean
    public StaticGasProvider gasProvider() {
        return new StaticGasProvider(gasPrice, gasLimit);
    }

    /**
     * Creates default gas provider for fallback scenarios
     */
    @Bean
    public DefaultGasProvider defaultGasProvider() {
        return new DefaultGasProvider();
    }

    /**
     * Contract address getter for dependency injection
     */
    @Bean
    public String contractAddress() {
        return contractAddress;
    }

    /**
     * Network name getter for dependency injection
     */
    @Bean
    public String networkName() {
        return networkName;
    }
}
