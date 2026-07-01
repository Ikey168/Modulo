import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/ui';

const About: React.FC = () => {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl animate-fade-in space-y-6">
        <section className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">About Modulo</h1>
          <p className="mt-2 text-base text-subtle-foreground">Building the future of blockchain technology</p>
        </section>

        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Our Mission</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-subtle-foreground">
                Modulo aims to simplify blockchain development and make it accessible
                to developers of all skill levels. We provide tools and infrastructure
                for building, deploying, and managing blockchain applications.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Technology Stack</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm leading-relaxed text-subtle-foreground">
                <li className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  Frontend: React with TypeScript
                </li>
                <li className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  Backend: Spring Boot
                </li>
                <li className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  Smart Contracts: Solidity &amp; Web3j
                </li>
                <li className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  Security: OpenID Connect authentication and policy-based
                  authorization, with optional on-chain content-hash anchoring for
                  integrity and verifiable authorship
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Our Team</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-subtle-foreground">
                We are a dedicated team of blockchain enthusiasts, developers, and
                industry experts working together to revolutionize the blockchain
                development landscape.
              </p>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Get in Touch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-subtle-foreground">
              <p>Email: contact@modulo.com</p>
              <p>GitHub: github.com/modulo</p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default About;
