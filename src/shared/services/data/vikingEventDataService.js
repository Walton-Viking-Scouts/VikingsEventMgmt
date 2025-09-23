import indexedDBService from '../storage/indexedDBService.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';
import dataServiceOrchestrator from './dataServiceOrchestrator.js';

class VikingEventDataService {
  constructor(orchestrator = dataServiceOrchestrator) {
    this.orchestrator = orchestrator;
    this.VIKING_EVENT_STRUCTURE_NAME = 'Viking Event Mgmt';
    this.cachedStructure = null;
    this.fieldMappings = null;
  }

  async getVikingEventStructure() {
    if (this.cachedStructure) {
      return this.cachedStructure;
    }

    try {
      const vikingStructure = await this.orchestrator.getVikingEventStructure();

      if (!vikingStructure) {
        logger.warn('Viking Event Mgmt structure not found via orchestrator', {}, LOG_CATEGORIES.DATA_SERVICE);
        return null;
      }

      this.cachedStructure = vikingStructure;
      return vikingStructure;
    } catch (err) {
      logger.error('Failed to retrieve Viking Event structure via orchestrator', {
        error: err,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  async getFieldMappings() {
    if (this.fieldMappings) {
      return this.fieldMappings;
    }

    try {
      this.fieldMappings = await this.orchestrator.getVikingEventFieldMappings();

      logger.debug('Retrieved field mappings via orchestrator', {
        mappingCount: Object.keys(this.fieldMappings).length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return this.fieldMappings;
    } catch (err) {
      logger.error('Failed to retrieve field mappings via orchestrator', {
        error: err,
      }, LOG_CATEGORIES.DATA_SERVICE);
      return {};
    }
  }

  async mapFlexiRecordToVikingEventData(flexiRecord, sectionId, flexiRecordId) {
    const fieldMappings = await this.getFieldMappings();

    const mappedData = {
      member_id: flexiRecord.scoutid || flexiRecord.member_id,
      section_id: Number(sectionId),
      flexirecord_id: flexiRecordId,
      last_updated: new Date().toISOString(),
    };

    for (const [flexiField, mappedField] of Object.entries(fieldMappings)) {
      mappedData[mappedField] = flexiRecord[flexiField] || null;
    }

    logger.debug('Mapped FlexiRecord to Viking Event data', {
      memberId: mappedData.member_id,
      campGroup: mappedData.camp_group,
      flexiRecordId: mappedData.flexi_record_id,
    }, LOG_CATEGORIES.DATA_SERVICE);

    return mappedData;
  }

  async mapVikingEventDataToFlexiRecord(vikingEventData) {
    const fieldMappings = await this.getFieldMappings();

    const flexiRecord = {
      scoutid: vikingEventData.member_id,
      flexirecordid: vikingEventData.flexirecord_id,
    };

    const reverseMappings = {};
    for (const [flexiField, mappedField] of Object.entries(fieldMappings)) {
      reverseMappings[mappedField] = flexiField;
    }

    for (const [mappedField, value] of Object.entries(vikingEventData)) {
      if (reverseMappings[mappedField]) {
        flexiRecord[reverseMappings[mappedField]] = value;
      }
    }

    logger.debug('Mapped Viking Event data to FlexiRecord', {
      memberId: flexiRecord.scoutid,
      flexiRecordId: flexiRecord.flexirecordid,
    }, LOG_CATEGORIES.DATA_SERVICE);

    return flexiRecord;
  }

  async saveVikingEventData(flexiRecord, sectionId, flexiRecordId) {
    try {
      const mappedData = await this.mapFlexiRecordToVikingEventData(flexiRecord, sectionId, flexiRecordId);
      const result = await indexedDBService.saveVikingEventData(mappedData);

      logger.info('Saved Viking Event data', {
        memberId: mappedData.member_id,
        sectionId: mappedData.section_id,
        flexiRecordId: mappedData.flexirecord_id,
        campGroup: mappedData.camp_group,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return result;
    } catch (err) {
      logger.error('Failed to save Viking Event data', {
        error: err,
        memberId: flexiRecord?.scoutid || flexiRecord?.member_id,
        sectionId,
        flexiRecordId,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  async getVikingEventDataByMemberId(memberId) {
    try {
      const result = await indexedDBService.getVikingEventDataByMemberId(memberId);

      logger.debug('Retrieved Viking Event data by member ID', {
        memberId,
        recordCount: result.length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return result;
    } catch (err) {
      logger.error('Failed to retrieve Viking Event data by member ID', {
        error: err,
        memberId,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  async getVikingEventDataByCampGroup(campGroup) {
    try {
      const result = await indexedDBService.getVikingEventDataByCampGroup(campGroup);

      logger.debug('Retrieved Viking Event data by camp group', {
        campGroup,
        recordCount: result.length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return result;
    } catch (err) {
      logger.error('Failed to retrieve Viking Event data by camp group', {
        error: err,
        campGroup,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  async getAllVikingEventData() {
    try {
      const result = await indexedDBService.getAllVikingEventData();

      logger.debug('Retrieved all Viking Event data', {
        recordCount: result.length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return result;
    } catch (err) {
      logger.error('Failed to retrieve all Viking Event data', {
        error: err,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  async getMemberCampGroups(memberId) {
    try {
      const memberData = await this.getVikingEventDataByMemberId(memberId);
      const campGroups = [...new Set(memberData
        .map(record => record.camp_group)
        .filter(group => group),
      )];

      logger.debug('Retrieved member camp groups', {
        memberId,
        campGroups: campGroups.length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return campGroups;
    } catch (err) {
      logger.error('Failed to retrieve member camp groups', {
        error: err,
        memberId,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  async getCampGroupMembers(campGroup) {
    try {
      const campData = await this.getVikingEventDataByCampGroup(campGroup);
      const memberIds = [...new Set(campData
        .map(record => record.member_id)
        .filter(id => id),
      )];

      logger.debug('Retrieved camp group members', {
        campGroup,
        memberCount: memberIds.length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return memberIds;
    } catch (err) {
      logger.error('Failed to retrieve camp group members', {
        error: err,
        campGroup,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  async getSignInOutHistory(memberId) {
    try {
      const memberData = await this.getVikingEventDataByMemberId(memberId);

      const history = memberData.map(record => ({
        campGroup: record.camp_group,
        signedInBy: record.signed_in_by,
        signedInWhen: record.signed_in_when,
        signedOutBy: record.signed_out_by,
        signedOutWhen: record.signed_out_when,
        isCurrentlySignedIn: record.signed_in_when && !record.signed_out_when,
        lastUpdated: record.last_updated,
      })).sort((a, b) => {
        const aDate = new Date(a.signedInWhen || 0);
        const bDate = new Date(b.signedInWhen || 0);
        return bDate - aDate;
      });

      logger.debug('Retrieved sign in/out history', {
        memberId,
        historyCount: history.length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return history;
    } catch (err) {
      logger.error('Failed to retrieve sign in/out history', {
        error: err,
        memberId,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw err;
    }
  }

  clearCache() {
    this.cachedStructure = null;
    this.fieldMappings = null;
    this.orchestrator.clearCacheForFlexiRecord(this.VIKING_EVENT_STRUCTURE_NAME);
    logger.debug('Cleared Viking Event data service cache', {}, LOG_CATEGORIES.DATA_SERVICE);
  }
}

const vikingEventDataService = new VikingEventDataService();
export default vikingEventDataService;