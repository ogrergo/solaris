

module.exports = class CombatService {
    
    constructor(technologyService, specialistService) {
        this.technologyService = technologyService;
        this.specialistService = specialistService;
    }

    calculate(game, defender, attacker, defenderBonus) {
        if (defenderBonus == null) {
            defenderBonus = game.settings.specialGalaxy.defenderBonus === 'enabled';
        }
    
        let defenderShipsRemaining = defender.ships,
            attackerShipsRemaining = attacker.ships;

        let defendPower = defender.weaponsLevel + (defenderBonus ? 1 : 0),
            attackPower = attacker.weaponsLevel;
            
        // Keep fighting until either carrier has no ships remaining.
        while (defenderShipsRemaining > 0 && attackerShipsRemaining > 0) {
            // Friendly carrier attacks first with defender bonus.
            attackerShipsRemaining -= defendPower;

            // Enemy carrier attacks next if there are still ships remaining.
            if (attackerShipsRemaining <= 0) {
                break;
            }

            defenderShipsRemaining -= attackPower;
        }

        attackerShipsRemaining = Math.max(0, attackerShipsRemaining)
        defenderShipsRemaining = Math.max(0, defenderShipsRemaining)

        return {
            weapons: {
                defender: defendPower,
                attacker: attackPower
            },
            before: {
                defender: defender.ships,
                attacker: attacker.ships
            },
            after: {
                defender: defenderShipsRemaining,
                attacker: attackerShipsRemaining
            },
            lost: {
                defender: defender.ships - defenderShipsRemaining,
                attacker: attacker.ships - attackerShipsRemaining
            }
        };
    }

    calculateStar(game, star, defender, attackers, defenderCarriers, attackerCarriers) {
        // Calculate the combined combat result taking into account
        // the star garrison and all defenders vs. all attackers
        let totalDefenders = Math.floor(star.garrisonActual) + defenderCarriers.reduce((sum, c) => sum + c.ships, 0);
        let totalAttackers = attackerCarriers.reduce((sum, c) => sum + c.ships, 0);

        // Calculate the weapons tech levels based on any specialists present at stars or carriers.
        let defenderWeaponsTechLevel;
        let defenderWeaponsTechLevelStar = this.technologyService.getStarEffectiveTechnologyLevels(game, star).weapons;
        let defenderWeaponsTechLevelCarriers = this.technologyService.getCarriersEffectiveWeaponsLevel(game, defenderCarriers, true);

        defenderWeaponsTechLevel = Math.max(defenderWeaponsTechLevelStar, defenderWeaponsTechLevelCarriers);
        
        // Use the highest weapons tech of the attacking players to calculate combat result.
        let attackerWeaponsTechLevel = this.technologyService.getCarriersEffectiveWeaponsLevel(game, attackerCarriers, true);

        // Check for deductions to weapons.
        let defenderWeaponsDeduction = this.getWeaponsDeduction(attackerCarriers, defenderCarriers);
        let attackerWeaponsDeduction = this.getWeaponsDeduction(defenderCarriers, attackerCarriers);

        // Note: Must fight with a minimum of 1.
        defenderWeaponsTechLevel = Math.max(defenderWeaponsTechLevel - defenderWeaponsDeduction, 1);
        attackerWeaponsTechLevel = Math.max(attackerWeaponsTechLevel - attackerWeaponsDeduction, 1);

        let combatResult = this.calculate(game,
        {
            weaponsLevel: defenderWeaponsTechLevel,
            ships: totalDefenders
        }, {
            weaponsLevel: attackerWeaponsTechLevel,
            ships: totalAttackers
        });

        return combatResult;
    }

    calculateCarrier(game, defenderCarriers, attackerCarriers) {
        let totalDefenders = defenderCarriers.reduce((sum, c) => sum + c.ships, 0);
        let totalAttackers = attackerCarriers.reduce((sum, c) => sum + c.ships, 0);

        // Calculate the weapons tech levels
        let defenderWeaponsTechLevel = this.technologyService.getCarriersEffectiveWeaponsLevel(game, defenderCarriers, false);
        let attackerWeaponsTechLevel = this.technologyService.getCarriersEffectiveWeaponsLevel(game, attackerCarriers, false);
        
        // Check for deductions to weapons.
        let defenderWeaponsDeduction = this.getWeaponsDeduction(attackerCarriers, defenderCarriers);
        let attackerWeaponsDeduction = this.getWeaponsDeduction(defenderCarriers, attackerCarriers);

        // Note: Must fight with a minimum of 1.
        defenderWeaponsTechLevel = Math.max(defenderWeaponsTechLevel - defenderWeaponsDeduction, 1);
        attackerWeaponsTechLevel = Math.max(attackerWeaponsTechLevel - attackerWeaponsDeduction, 1);

        let combatResult = this.calculate(game,
        {
            weaponsLevel: defenderWeaponsTechLevel,
            ships: totalDefenders
        }, {
            weaponsLevel: attackerWeaponsTechLevel,
            ships: totalAttackers
        },
        false);

        return combatResult;
    }

    getWeaponsDeduction(carriersToCheck, carriersToAffect) {
        let deduction = 0;
        
        if (!carriersToCheck.length) {
            return 0;
        }
        
        // If any of the carriers have a specialist which deducts enemy weapons
        // then find the one that has the highest deduction.
        deduction = carriersToCheck.map(c => {
            let specialist = this.specialistService.getByIdCarrier(c.specialistId);

            if (specialist && specialist.modifiers.special && specialist.modifiers.special.deductEnemyWeapons) {
                return specialist.modifiers.special.deductEnemyWeapons;
            }

            return 0;
        })
        .sort((a, b) => b - a)[0];

        return deduction;
    }
    
}
