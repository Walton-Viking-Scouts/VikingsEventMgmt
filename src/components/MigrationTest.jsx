import React, { useState } from 'react';
import {
  Button, Card, Input, Select, Alert, Badge, Modal,
  FormSection, FormRow
} from './ui';
import Header from './Header';
import LoginScreen from './LoginScreen';
import LoadingScreen from './LoadingScreen';
import SectionsList from './SectionsList';
import OfflineIndicator from './OfflineIndicator';

/**
 * Migration Test Component
 * 
 * This component tests all migrated components to ensure they work correctly
 * with Tailwind CSS. Use this for visual verification during migration.
 * 
 * Remove this file after migration is complete.
 */
const MigrationTest = () => {
  const [showModal, setShowModal] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [selectedSections, setSelectedSections] = useState([]);

  // Mock data for testing
  const mockUser = {
    firstname: 'John',
    lastname: 'Doe',
    userid: '123'
  };

  const mockSections = [
    { sectionid: '1', sectionname: 'Beavers Colony', section: 'beavers' },
    { sectionid: '2', sectionname: 'Cubs Pack', section: 'cubs' },
    { sectionid: '3', sectionname: 'Scouts Troop', section: 'scouts' },
    { sectionid: '4', sectionname: 'Explorers Unit', section: 'explorers' },
  ];

  const handleSectionToggle = (section) => {
    setSelectedSections(prev => {
      const exists = prev.find(s => s.sectionid === section.sectionid);
      if (exists) {
        return prev.filter(s => s.sectionid !== section.sectionid);
      } else {
        return [...prev, section];
      }
    });
  };

  const handleLogin = () => {
    setShowLogin(false);
    alert('Login successful!');
  };

  const handleLogout = () => {
    alert('Logged out!');
  };

  const showLoadingTest = () => {
    setShowLoading(true);
    setTimeout(() => setShowLoading(false), 3000);
  };

  if (showLogin) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (showLoading) {
    return <LoadingScreen message="Testing loading component..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Test */}
      <Header user={mockUser} onLogout={handleLogout} />
      
      {/* Offline Indicator Test */}
      <OfflineIndicator />
      
      <div className="container mx-auto px-4 py-20 max-w-6xl space-y-8">
        
        {/* Migration Status */}
        <Alert variant="scout-blue" className="mb-8">
          <Alert.Title>🎉 Migration Test Page</Alert.Title>
          <Alert.Description>
            All components below have been migrated to use Tailwind CSS with Scout theming.
            This page demonstrates the successful migration from Bootstrap to Tailwind.
          </Alert.Description>
        </Alert>

        {/* Component Tests */}
        <FormSection title="Component Testing" subtitle="Test migrated components">
          
          {/* Button Tests */}
          <Card>
            <Card.Header>
              <Card.Title>Migrated Buttons</Card.Title>
            </Card.Header>
            <Card.Body>
              <div className="flex flex-wrap gap-4">
                <Button variant="scout-blue">Scout Blue</Button>
                <Button variant="scout-green">Scout Green</Button>
                <Button variant="scout-red">Scout Red</Button>
                <Button variant="outline-scout-blue">Outline</Button>
                <Button variant="primary" loading>Loading</Button>
                <Button variant="secondary" disabled>Disabled</Button>
              </div>
            </Card.Body>
          </Card>

          {/* Badge Tests */}
          <Card>
            <Card.Header>
              <Card.Title>Migrated Badges & Status</Card.Title>
            </Card.Header>
            <Card.Body>
              <div className="flex flex-wrap gap-4 items-center">
                <Badge variant="scout-blue">Scout Blue</Badge>
                <Badge variant="scout-green">Active</Badge>
                <Badge variant="scout-red">Urgent</Badge>
                <Badge.Number count={5} variant="scout-orange" />
                <Badge.Dot variant="success" />
                <span className="text-sm text-gray-600">Online</span>
              </div>
            </Card.Body>
          </Card>

          {/* Form Tests */}
          <Card>
            <Card.Header>
              <Card.Title>Migrated Form Components</Card.Title>
            </Card.Header>
            <Card.Body>
              <FormRow>
                <Input 
                  label="Name" 
                  placeholder="Enter your name"
                  variant="scout"
                />
                <Select 
                  label="Section"
                  placeholder="Choose section..."
                >
                  <option value="beavers">Beavers</option>
                  <option value="cubs">Cubs</option>
                  <option value="scouts">Scouts</option>
                </Select>
              </FormRow>
            </Card.Body>
          </Card>

          {/* Screen Component Tests */}
          <Card>
            <Card.Header>
              <Card.Title>Migrated Screen Components</Card.Title>
            </Card.Header>
            <Card.Body>
              <div className="flex flex-wrap gap-4">
                <Button variant="scout-blue" onClick={() => setShowLogin(true)}>
                  Test Login Screen
                </Button>
                <Button variant="scout-green" onClick={showLoadingTest}>
                  Test Loading Screen
                </Button>
                <Button variant="scout-orange" onClick={() => setShowModal(true)}>
                  Test Modal
                </Button>
              </div>
            </Card.Body>
          </Card>

          {/* Sections List Test */}
          <SectionsList
            sections={mockSections}
            selectedSections={selectedSections}
            onSectionToggle={handleSectionToggle}
            onContinueToEvents={() => alert('Continue to events!')}
          />

          {/* Migration Status Summary */}
          <Card>
            <Card.Header>
              <Card.Title>Migration Progress</Card.Title>
            </Card.Header>
            <Card.Body>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <Badge variant="scout-green" className="mb-2">✓ Complete</Badge>
                    <p className="text-sm">LoginScreen</p>
                  </div>
                  <div className="text-center">
                    <Badge variant="scout-green" className="mb-2">✓ Complete</Badge>
                    <p className="text-sm">LoadingScreen</p>
                  </div>
                  <div className="text-center">
                    <Badge variant="scout-green" className="mb-2">✓ Complete</Badge>
                    <p className="text-sm">SectionsList</p>
                  </div>
                  <div className="text-center">
                    <Badge variant="scout-green" className="mb-2">✓ Complete</Badge>
                    <p className="text-sm">Header</p>
                  </div>
                  <div className="text-center">
                    <Badge variant="scout-green" className="mb-2">✓ Complete</Badge>
                    <p className="text-sm">OfflineIndicator</p>
                  </div>
                  <div className="text-center">
                    <Badge variant="scout-blue" className="mb-2">📦 Library</Badge>
                    <p className="text-sm">UI Components</p>
                  </div>
                </div>
                
                <Alert variant="success">
                  <Alert.Title>Phase 3 Complete!</Alert.Title>
                  <Alert.Description>
                    Successfully migrated core components from Bootstrap to Tailwind CSS.
                    All components now use Scout theming and responsive design.
                  </Alert.Description>
                </Alert>
              </div>
            </Card.Body>
          </Card>
        </FormSection>
      </div>

      {/* Modal Test */}
      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)}
        size="md"
      >
        <Modal.Header>
          <Modal.Title>Migration Test Modal</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-gray-600 mb-4">
            This modal has been successfully migrated to use Tailwind CSS!
          </p>
          <Alert variant="scout-blue">
            <Alert.Description>
              Modal includes keyboard navigation, focus management, and Scout theming.
            </Alert.Description>
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline" onClick={() => setShowModal(false)}>
            Close
          </Button>
          <Button variant="scout-blue" onClick={() => setShowModal(false)}>
            Confirm
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default MigrationTest;