/**
 * ChannelKey - AlertaCare Domain Model
 * 
 * Manages AlertaCare channel key generation, validation and parsing.
 * Implements the convention: <habitacion>.<posicion>.<origen>.<canal>.tap
 * 
 * @domain AlertaCare
 * @author AlertaCare Team
 */

class ChannelKey {
    /**
     * Create a ChannelKey instance
     * @param {Object} components - Channel components
     * @param {string} components.habitacion - Room identifier
     * @param {string} components.posicion - Camera position
     * @param {string} components.origen - Stream origin
     * @param {string} components.canal - Channel type
     */
    constructor({ habitacion, posicion, origen, canal }) {
        this.habitacion = habitacion;
        this.posicion = posicion;
        this.origen = origen;
        this.canal = canal;
        
        this._validate();
        this._key = this._generate();
    }

    /**
     * Validate all required components
     * @private
     */
    _validate() {
        const required = ['habitacion', 'posicion', 'origen', 'canal'];
        const missing = required.filter(field => !this[field] || this[field].trim() === '');
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }

        // Additional validation rules
        this._validateComponent('habitacion', this.habitacion);
        this._validateComponent('posicion', this.posicion);
        this._validateComponent('origen', this.origen);
        this._validateComponent('canal', this.canal);
    }

    /**
     * Validate individual component format
     * @private
     */
    _validateComponent(name, value) {
        // No spaces, no special chars except underscore
        const validPattern = /^[a-zA-Z0-9_]+$/;
        if (!validPattern.test(value)) {
            throw new Error(`Invalid ${name} format: '${value}'. Only alphanumeric and underscore allowed.`);
        }

        // Length limits
        if (value.length > 50) {
            throw new Error(`${name} too long: '${value}'. Maximum 50 characters.`);
        }
    }

    /**
     * Generate channel key string
     * @private
     */
    _generate() {
        return `${this.habitacion}.${this.posicion}.${this.origen}.${this.canal}.tap`;
    }

    /**
     * Get the channel key string
     * @returns {string} Complete channel key
     */
    toString() {
        return this._key;
    }

    /**
     * Get channel components as object
     * @returns {Object} Channel components
     */
    getComponents() {
        return {
            habitacion: this.habitacion,
            posicion: this.posicion,
            origen: this.origen,
            canal: this.canal
        };
    }

    /**
     * Check if this channel matches a pattern
     * @param {Object} pattern - Pattern to match against
     * @returns {boolean} True if matches
     */
    matches(pattern) {
        const components = this.getComponents();
        
        return Object.keys(pattern).every(key => {
            if (pattern[key] === '*') return true;
            return components[key] === pattern[key];
        });
    }

    /**
     * Create ChannelKey from string representation
     * @param {string} keyString - Channel key string
     * @returns {ChannelKey} ChannelKey instance
     */
    static fromString(keyString) {
        if (!keyString || typeof keyString !== 'string') {
            throw new Error('Invalid channel key string');
        }

        if (!keyString.endsWith('.tap')) {
            throw new Error('Channel key must end with .tap suffix');
        }

        const parts = keyString.replace('.tap', '').split('.');
        
        if (parts.length !== 4) {
            throw new Error('Invalid channel key format. Expected: habitacion.posicion.origen.canal.tap');
        }

        const [habitacion, posicion, origen, canal] = parts;
        return new ChannelKey({ habitacion, posicion, origen, canal });
    }

    /**
     * Create ChannelKey from metadata object
     * @param {Object} meta - Metadata object
     * @returns {ChannelKey} ChannelKey instance
     */
    static fromMetadata(meta) {
        return new ChannelKey(meta);
    }

    /**
     * Validate if string is a valid channel key format
     * @param {string} keyString - String to validate
     * @returns {boolean} True if valid format
     */
    static isValidFormat(keyString) {
        try {
            ChannelKey.fromString(keyString);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get all possible position values (could be configurable)
     * @returns {Array} Valid position values
     */
    static getValidPositions() {
        return [
            'base_larga',
            'base_corta', 
            'lateral_der',
            'lateral_izq',
            'techo',
            'puerta'
        ];
    }

    /**
     * Get all possible origen values
     * @returns {Array} Valid origen values
     */
    static getValidOrigenes() {
        return [
            'principal',
            'secundario',
            'backup'
        ];
    }

    /**
     * Get all possible canal values
     * @returns {Array} Valid canal values
     */
    static getValidCanales() {
        return [
            'inference',
            'tracker',
            'alerts',
            'raw',
            'processed',
            'metrics'
        ];
    }
}

module.exports = ChannelKey; 