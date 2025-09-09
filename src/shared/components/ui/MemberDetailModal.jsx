import React from 'react';
import PropTypes from 'prop-types';

function MemberDetailModal({ member, isOpen, onClose }) {
  if (!isOpen || !member) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-96 overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Member Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-3">
            <div>
              <span className="font-medium text-gray-700">Name: </span>
              <span className="text-gray-900">
                {member.firstname} {member.lastname}
              </span>
            </div>
            
            {member.sectionname && (
              <div>
                <span className="font-medium text-gray-700">Section: </span>
                <span className="text-gray-900">{member.sectionname}</span>
              </div>
            )}
            
            {member.email && (
              <div>
                <span className="font-medium text-gray-700">Email: </span>
                <span className="text-gray-900">{member.email}</span>
              </div>
            )}
            
            {member.phone && (
              <div>
                <span className="font-medium text-gray-700">Phone: </span>
                <span className="text-gray-900">{member.phone}</span>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

MemberDetailModal.propTypes = {
  member: PropTypes.shape({
    firstname: PropTypes.string,
    lastname: PropTypes.string,
    sectionname: PropTypes.string,
    email: PropTypes.string,
    phone: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default MemberDetailModal;