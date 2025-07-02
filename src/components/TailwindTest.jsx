import React from 'react';
import { Button, Card } from './ui';

/**
 * Test component to verify Tailwind CSS is working properly
 * This component showcases the new Tailwind components alongside
 * Scout-themed styling. Remove after migration is complete.
 */
const TailwindTest = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Tailwind CSS Test - Scout Theme
      </h1>
      
      {/* Scout-themed buttons */}
      <Card>
        <Card.Header>
          <Card.Title>Scout-Themed Buttons</Card.Title>
        </Card.Header>
        <Card.Body>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button variant="scout-blue">Scout Blue</Button>
            <Button variant="scout-green">Scout Green</Button>
            <Button variant="scout-red">Scout Red</Button>
            <Button variant="scout-orange">Scout Orange</Button>
            <Button variant="scout-yellow">Scout Yellow</Button>
            <Button variant="scout-pink">Scout Pink</Button>
            <Button variant="scout-forest-green">Forest Green</Button>
          </div>
        </Card.Body>
      </Card>

      {/* Outline variants */}
      <Card>
        <Card.Header>
          <Card.Title>Outline Variants</Card.Title>
        </Card.Header>
        <Card.Body>
          <div className="flex flex-wrap gap-4">
            <Button variant="outline-scout-blue">Outline Blue</Button>
            <Button variant="outline-scout-green">Outline Green</Button>
            <Button variant="outline-scout-red">Outline Red</Button>
          </div>
        </Card.Body>
      </Card>

      {/* Different sizes */}
      <Card>
        <Card.Header>
          <Card.Title>Button Sizes</Card.Title>
        </Card.Header>
        <Card.Body>
          <div className="flex items-center gap-4">
            <Button variant="scout-blue" size="sm">Small</Button>
            <Button variant="scout-blue" size="md">Medium</Button>
            <Button variant="scout-blue" size="lg">Large</Button>
            <Button variant="scout-blue" size="xl">Extra Large</Button>
          </div>
        </Card.Body>
      </Card>

      {/* Loading state */}
      <Card>
        <Card.Header>
          <Card.Title>Loading State</Card.Title>
        </Card.Header>
        <Card.Body>
          <div className="flex gap-4">
            <Button variant="scout-green" loading>Loading...</Button>
            <Button variant="primary" disabled>Disabled</Button>
          </div>
        </Card.Body>
      </Card>

      {/* Utility classes test */}
      <Card>
        <Card.Header>
          <Card.Title>Tailwind Utility Classes</Card.Title>
        </Card.Header>
        <Card.Body>
          <div className="space-y-4">
            <div className="bg-scout-blue text-white p-4 rounded-lg">
              Background: bg-scout-blue
            </div>
            <div className="text-scout-green text-2xl font-bold">
              Text: text-scout-green text-2xl font-bold
            </div>
            <div className="border-2 border-scout-red p-4 rounded-md">
              Border: border-2 border-scout-red
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Responsive grid */}
      <Card>
        <Card.Header>
          <Card.Title>Responsive Grid</Card.Title>
        </Card.Header>
        <Card.Body>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-scout-blue-light text-white p-4 rounded-lg text-center">
                Item {i}
              </div>
            ))}
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default TailwindTest;