import React, { useState } from 'react';
import { 
  Button, Card, Input, Select, Checkbox, Modal, Alert, Badge, Header, 
  FormSection, FormRow, FormActions, Dropdown, Nav, NavItem, Menu,
  CardHeader, CardTitle, CardBody, CardFooter,
  ModalHeader, ModalTitle, ModalBody, ModalFooter,
  AlertTitle, AlertDescription, AlertActions,
} from './index';

/**
 * Component Showcase - Demonstrates all Tailwind UI components
 * Use this as a visual guide and code reference during migration
 * Remove this file after migration is complete
 */
const ComponentShowcase = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [alertVisible, setAlertVisible] = useState(true);
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [selectValue, setSelectValue] = useState('');
  const [inputValue, setInputValue] = useState('');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Example */}
      <Header variant="scout" fixed={false}>
        <Header.Container>
          <Header.Content>
            <Header.Left>
              <Header.Title>Scout Component Library</Header.Title>
            </Header.Left>
            <Header.Center>
              <Nav variant="horizontal">
                <NavItem active>Showcase</NavItem>
                <NavItem>Documentation</NavItem>
                <NavItem>Migration Guide</NavItem>
              </Nav>
            </Header.Center>
            <Header.Right>
              <Dropdown
                trigger={
                  <Button variant="ghost" className="text-white hover:bg-scout-blue-light">
                    Menu ▾
                  </Button>
                }
              >
                <Menu.Item>Profile</Menu.Item>
                <Menu.Item>Settings</Menu.Item>
                <Menu.Divider />
                <Menu.Item variant="danger">Logout</Menu.Item>
              </Dropdown>
            </Header.Right>
          </Header.Content>
        </Header.Container>
      </Header>

      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
        
        {/* Buttons Section */}
        <FormSection title="Buttons" subtitle="Scout-themed button components with various styles and states">
          <Card>
            <CardHeader>
              <CardTitle>Scout Color Variants</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button variant="scout-blue">Scout Blue</Button>
                <Button variant="scout-green">Scout Green</Button>
                <Button variant="scout-red">Scout Red</Button>
                <Button variant="scout-orange">Scout Orange</Button>
                <Button variant="scout-yellow">Scout Yellow</Button>
                <Button variant="scout-pink">Scout Pink</Button>
                <Button variant="scout-forest-green">Forest Green</Button>
                <Button variant="outline-scout-blue">Outline Blue</Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Button Sizes & States</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Button variant="scout-blue" size="sm">Small</Button>
                  <Button variant="scout-blue" size="md">Medium</Button>
                  <Button variant="scout-blue" size="lg">Large</Button>
                  <Button variant="scout-blue" size="xl">Extra Large</Button>
                </div>
                <div className="flex items-center gap-4">
                  <Button variant="scout-green" loading>Loading...</Button>
                  <Button variant="secondary" disabled>Disabled</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="outline">Outline</Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </FormSection>

        {/* Form Components */}
        <FormSection title="Form Components" subtitle="Input fields, selects, and form layouts with validation states">
          <Card>
            <CardHeader>
              <CardTitle>Form Example</CardTitle>
            </CardHeader>
            <CardBody>
              <form className="space-y-4">
                <FormRow>
                  <Input
                    label="First Name"
                    placeholder="Enter your first name"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    helperText="This is a helper text"
                  />
                  <Input
                    label="Last Name"
                    placeholder="Enter your last name"
                    variant="scout"
                  />
                </FormRow>

                <Input
                  label="Email Address"
                  type="email"
                  placeholder="your@email.com"
                  error={inputValue === 'error'}
                  errorText={inputValue === 'error' ? 'Please enter a valid email' : ''}
                  leftIcon="📧"
                />

                <Select
                  label="Scout Section"
                  value={selectValue}
                  onChange={(e) => setSelectValue(e.target.value)}
                  placeholder="Choose your section..."
                >
                  <option value="beavers">Beavers</option>
                  <option value="cubs">Cubs</option>
                  <option value="scouts">Scouts</option>
                  <option value="explorers">Explorers</option>
                  <option value="network">Network</option>
                </Select>

                <Checkbox
                  label="I agree to the terms and conditions"
                  description="Please read our terms and conditions before proceeding"
                  checked={checkboxChecked}
                  onChange={(e) => setCheckboxChecked(e.target.checked)}
                />

                <FormActions>
                  <Button variant="outline">Cancel</Button>
                  <Button variant="scout-blue">Submit</Button>
                </FormActions>
              </form>
            </CardBody>
          </Card>
        </FormSection>

        {/* Badges */}
        <FormSection title="Badges & Status" subtitle="Status indicators, counts, and labels">
          <Card>
            <CardHeader>
              <CardTitle>Badge Variants</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="scout-blue">Scout Blue</Badge>
                  <Badge variant="scout-green">Active</Badge>
                  <Badge variant="scout-red">Urgent</Badge>
                  <Badge variant="scout-orange">Warning</Badge>
                  <Badge variant="success">Success</Badge>
                  <Badge variant="error">Error</Badge>
                  <Badge variant="outline-scout-blue">Outline</Badge>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span>Status:</span>
                    <Badge.Dot variant="scout-green" />
                    <span className="text-sm text-gray-600">Online</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span>Notifications:</span>
                    <Badge.Number count={12} />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span>High Count:</span>
                    <Badge.Number count={150} max={99} variant="scout-red" />
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </FormSection>

        {/* Alerts */}
        <FormSection title="Alerts" subtitle="Important messages and notifications">
          {alertVisible && (
            <Alert 
              variant="scout-blue" 
              dismissible 
              onDismiss={() => setAlertVisible(false)}
            >
              <AlertTitle>Welcome to the Scout Component Library!</AlertTitle>
              <AlertDescription>
                This showcase demonstrates all available Tailwind components with Scout theming. 
                Use these components to gradually migrate from Bootstrap.
              </AlertDescription>
              <AlertActions>
                <Button variant="scout-blue" size="sm">Learn More</Button>
                <Button variant="outline" size="sm">Documentation</Button>
              </AlertActions>
            </Alert>
          )}

          <div className="grid gap-4">
            <Alert variant="success">
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>Your form has been submitted successfully.</AlertDescription>
            </Alert>

            <Alert variant="warning" icon={true}>
              <AlertDescription>
                Please review your information before submitting.
              </AlertDescription>
            </Alert>

            <Alert variant="error">
              <AlertTitle>Error occurred</AlertTitle>
              <AlertDescription>
                There was a problem processing your request. Please try again.
              </AlertDescription>
            </Alert>
          </div>
        </FormSection>

        {/* Modal Example */}
        <FormSection title="Modal" subtitle="Overlay dialogs and popups">
          <Card>
            <CardBody>
              <Button variant="scout-blue" onClick={() => setModalOpen(true)}>
                Open Modal Example
              </Button>
            </CardBody>
          </Card>
        </FormSection>

        {/* Cards */}
        <FormSection title="Cards" subtitle="Content containers and layout components">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Simple Card</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-gray-600">
                  This is a basic card component with header and body sections.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Card with Footer</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-gray-600">
                  This card includes a footer section with actions.
                </p>
              </CardBody>
              <CardFooter>
                <Button variant="scout-green" size="sm">Action</Button>
                <Button variant="outline" size="sm">Cancel</Button>
              </CardFooter>
            </Card>
          </div>
        </FormSection>

        {/* Usage Guide */}
        <FormSection title="Migration Guide" subtitle="How to migrate from Bootstrap to Tailwind components">
          <Card>
            <CardBody>
              <div className="prose prose-sm max-w-none">
                <h4>Quick Migration Examples:</h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-3 text-sm">
                  <div>
                    <strong>Button:</strong><br />
                    <span className="text-red-600">Bootstrap:</span> <code>&lt;button class=&quot;btn btn-primary&quot;&gt;</code><br />
                    <span className="text-green-600">Tailwind:</span> <code>&lt;Button variant=&quot;scout-blue&quot;&gt;</code>
                  </div>
                  <div>
                    <strong>Card:</strong><br />
                    <span className="text-red-600">Bootstrap:</span> <code>&lt;div class=&quot;card&quot;&gt;&lt;div class=&quot;card-body&quot;&gt;</code><br />
                    <span className="text-green-600">Tailwind:</span> <code>&lt;Card&gt;&lt;Card.Body&gt;</code>
                  </div>
                  <div>
                    <strong>Form:</strong><br />
                    <span className="text-red-600">Bootstrap:</span> <code>&lt;div class=&quot;form-group&quot;&gt;&lt;input class=&quot;form-control&quot;&gt;</code><br />
                    <span className="text-green-600">Tailwind:</span> <code>&lt;Input label=&quot;Name&quot; placeholder=&quot;...&quot;&gt;</code>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </FormSection>
      </div>

      {/* Modal */}
      <Modal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        size="lg"
      >
        <ModalHeader>
          <ModalTitle>Modal Example</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="text-gray-600 mb-4">
            This is an example modal using the Tailwind Modal component. It supports:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-gray-600">
            <li>Keyboard navigation (ESC to close)</li>
            <li>Click outside to close</li>
            <li>Focus management</li>
            <li>Different sizes</li>
            <li>Scout theming</li>
          </ul>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="scout-blue" onClick={() => setModalOpen(false)}>
            Confirm
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default ComponentShowcase;