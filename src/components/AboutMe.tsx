
import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AboutMeProps {
  className?: string;
}

export function AboutMe({ className }: AboutMeProps) {
  return (
    <Card className={cn("p-5 md:p-8 backdrop-panel overflow-hidden", className)}>
      <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
        <div className="flex-shrink-0">
          <div className="relative w-36 h-36 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 overflow-hidden rounded-full border-4 border-primary/20">
            <img 
              src="/lovable-uploads/c9bd72dd-8059-4f9b-b068-b0752dff3ce3.png" 
              alt="Gaurav - Creator of Presence" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        
        <div className="space-y-3 md:space-y-4 text-center md:text-left">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">About Me</h2>
            <div className="w-12 md:w-16 h-1 bg-primary rounded-full mb-3 md:mb-6 mx-auto md:mx-0"></div>
          </div>
          
          <p className="text-base md:text-lg">
            Hi there! I'm <span className="font-semibold text-primary">Gaurav</span>, the creator of Presence. I'm a passionate developer with expertise in Java, Python, and React.
          </p>
          
          <p className="text-sm md:text-base text-muted-foreground">
            I built Presence to revolutionize attendance tracking systems using facial recognition technology. With a background in both frontend and backend development, I've crafted this solution to be intuitive, reliable, and secure.
          </p>
          
          <div className="flex flex-wrap gap-2 justify-center md:justify-start pt-2">
            {["React", "TypeScript", "Java", "Python", "AI"].map((skill) => (
              <span 
                key={skill}
                className="px-2 py-1 md:px-3 md:py-1 bg-primary/10 text-primary rounded-full text-xs md:text-sm font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
