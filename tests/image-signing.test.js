// Test for validating container image signing integration
// This would be a JavaScript/TypeScript test for the frontend or Node.js testing

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('Container Image Signing Integration', () => {
  
  test('should have valid Kyverno policies', () => {
    const policiesDir = path.join(__dirname, '../../k8s/policies');
    expect(fs.existsSync(policiesDir)).toBe(true);
    
    const policyFiles = fs.readdirSync(policiesDir).filter(f => f.endsWith('.yaml'));
    expect(policyFiles.length).toBeGreaterThan(0);
    
    // Validate YAML syntax
    policyFiles.forEach(file => {
      const content = fs.readFileSync(path.join(policiesDir, file), 'utf8');
      expect(() => {
        require('yaml').parse(content);
      }).not.toThrow();
    });
  });

  test('should have Cosign configuration in CI workflow', () => {
    const workflowPath = path.join(__dirname, '../../.github/workflows/docker-build.yml');
    expect(fs.existsSync(workflowPath)).toBe(true);
    
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    expect(workflow).toContain('cosign');
    expect(workflow).toContain('sigstore/cosign-installer');
  });

  test('should reference correct registry in policies', () => {
    const policyPath = path.join(__dirname, '../../k8s/policies/verify-image-signatures.yaml');
    const policy = fs.readFileSync(policyPath, 'utf8');
    
    expect(policy).toContain('ghcr.io/ikey168/modulo');
    expect(policy).toContain('keyless');
    expect(policy).toContain('token.actions.githubusercontent.com');
  });

  test('should have proper validation failure action', () => {
    const policyPath = path.join(__dirname, '../../k8s/policies/verify-image-signatures.yaml');
    const policy = fs.readFileSync(policyPath, 'utf8');
    
    expect(policy).toContain('validationFailureAction: Enforce');
  });

  test('should have setup script with correct Kyverno version', () => {
    const setupPath = path.join(__dirname, '../../scripts/setup-image-signing.sh');
    const setup = fs.readFileSync(setupPath, 'utf8');
    
    expect(setup).toContain('--version v1.8.5');
  });

  test('should validate image reference patterns', () => {
    const policyPath = path.join(__dirname, '../../k8s/policies/verify-image-signatures.yaml');
    const policy = fs.readFileSync(policyPath, 'utf8');
    
    // Should have proper image reference patterns
    expect(policy).toContain('ghcr.io/ikey168/modulo/*');
  });

  test('should have SLSA attestation configuration', () => {
    const workflowPath = path.join(__dirname, '../../.github/workflows/docker-build.yml');
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    
    expect(workflow).toContain('slsa-framework/slsa-github-generator');
  });

});

module.exports = {
  // Export test utilities for use in other tests
  validateImageSigningConfig: () => {
    // Comprehensive validation function
    const results = {
      policiesValid: false,
      cosignConfigured: false,
      registryConfigured: false,
      enforcementEnabled: false
    };

    try {
      // Check policies
      const policiesDir = path.join(__dirname, '../../k8s/policies');
      if (fs.existsSync(policiesDir)) {
        const files = fs.readdirSync(policiesDir).filter(f => f.endsWith('.yaml'));
        results.policiesValid = files.length > 0;
      }

      // Check Cosign in workflow
      const workflowPath = path.join(__dirname, '../../.github/workflows/docker-build.yml');
      if (fs.existsSync(workflowPath)) {
        const content = fs.readFileSync(workflowPath, 'utf8');
        results.cosignConfigured = content.includes('cosign');
      }

      // Check registry configuration
      const policyPath = path.join(__dirname, '../../k8s/policies/verify-image-signatures.yaml');
      if (fs.existsSync(policyPath)) {
        const content = fs.readFileSync(policyPath, 'utf8');
        results.registryConfigured = content.includes('ghcr.io/ikey168/modulo');
        results.enforcementEnabled = content.includes('validationFailureAction: Enforce');
      }

    } catch (error) {
      console.error('Validation error:', error);
    }

    return results;
  }
};
