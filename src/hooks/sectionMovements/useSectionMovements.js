import { useState, useEffect } from 'react';
import databaseService from '../../services/database.js';

export default function useSectionMovements() {
  const [sections, setSections] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [sectionsData, allMembers] = await Promise.all([
          databaseService.getSections(),
          loadAllMembers(),
        ]);

        if (!isMounted) return;

        setSections(sectionsData || []);
        setMembers(allMembers || []);
      } catch (err) {
        if (!isMounted) return;
        setError(err.message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadAllMembers = async () => {
    const sectionsData = await databaseService.getSections();
    if (!sectionsData || sectionsData.length === 0) {
      return [];
    }

    const sectionIds = sectionsData.map(section => section.sectionid);
    return await databaseService.getMembers(sectionIds);
  };

  const refetch = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [sectionsData, allMembers] = await Promise.all([
        databaseService.getSections(),
        loadAllMembers(),
      ]);

      setSections(sectionsData || []);
      setMembers(allMembers || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    sections,
    members,
    loading,
    error,
    refetch,
  };
}