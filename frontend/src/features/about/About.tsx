import React from 'react';

const About: React.FC = () => {
  return (
    <div className="about-container">
      <section className="about-header">
        <h1>About Modulo</h1>
        <p className="lead">Building the future of blockchain technology</p>
      </section>

      <section className="about-content">
        <div className="mission">
          <h2>Our Mission</h2>
          <p>
            Modulo aims to simplify blockchain development and make it accessible
            to developers of all skill levels. We provide tools and infrastructure
            for building, deploying, and managing blockchain applications.
          </p>
        </div>

        <div className="tech-stack">
          <h2>Technology Stack</h2>
          <ul>
            <li>Frontend: React with TypeScript</li>
            <li>Backend: Spring Boot</li>
            <li>Smart Contracts: Solidity & Web3j</li>
            <li>Security: Industry-standard encryption</li>
          </ul>
        </div>

        <div className="team">
          <h2>Our Team</h2>
          <p>
            We are a dedicated team of blockchain enthusiasts, developers, and
            industry experts working together to revolutionize the blockchain
            development landscape.
          </p>
        </div>
      </section>

      <section className="contact-info">
        <h2>Get in Touch</h2>
        <p>Email: contact@modulo.com</p>
        <p>GitHub: github.com/modulo</p>
      </section>
    </div>
  );
};

export default About;