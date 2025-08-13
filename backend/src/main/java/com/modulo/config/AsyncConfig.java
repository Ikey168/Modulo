package com.modulo.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Configuration for asynchronous processing
 * Used by blockchain operations to avoid blocking HTTP requests
 */
@Slf4j
@Configuration
@EnableAsync
public class AsyncConfig {

    /**
     * Task executor for blockchain operations
     */
    @Bean(name = "blockchainTaskExecutor")
    public Executor blockchainTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        
        // Core number of threads
        executor.setCorePoolSize(5);
        
        // Maximum number of threads
        executor.setMaxPoolSize(10);
        
        // Queue capacity
        executor.setQueueCapacity(100);
        
        // Thread name prefix
        executor.setThreadNamePrefix("blockchain-");
        
        // Wait for tasks to complete on shutdown
        executor.setWaitForTasksToCompleteOnShutdown(true);
        
        // Maximum time to wait for shutdown
        executor.setAwaitTerminationSeconds(60);
        
        // Rejection policy
        executor.setRejectedExecutionHandler((runnable, executor1) -> {
            log.warn("Blockchain task rejected: {}", runnable.toString());
            throw new RuntimeException("Blockchain task executor queue is full");
        });
        
        executor.initialize();
        
        log.info("Blockchain task executor initialized with core={}, max={}, queue={}",
                executor.getCorePoolSize(), executor.getMaxPoolSize(), executor.getQueueCapacity());
        
        return executor;
    }

    /**
     * General purpose async task executor
     */
    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("async-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        
        executor.initialize();
        
        log.info("General task executor initialized");
        
        return executor;
    }
}
