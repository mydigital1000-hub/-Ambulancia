import Dexie, { type EntityTable } from 'dexie';

// Tabela de Configuração
export interface Config {
  id: number; // ID fixo (ex: 1) para manter apenas um registro
  valorPrimeiraViagem: number;
  valorSegundaViagem: number;
  motoristaNome?: string;
}

// Tabela de Viagens
export interface Viagem {
  id?: number; // Auto-incremento
  destino: 'Cássia' | 'Passos';
  data_completa: string; // Data em formato ISO
  valor_ganho: number;
}

// Classe DatabaseHelper (adaptada para Web com Dexie/IndexedDB)
class DatabaseHelper extends Dexie {
  config!: EntityTable<Config, 'id'>;
  viagens!: EntityTable<Viagem, 'id'>;

  constructor() {
    super('AmbulanceDB');
    
    // Definindo o esquema do banco de dados
    this.version(2).stores({
      config: 'id',
      viagens: '++id, destino, data_completa'
    }).upgrade(tx => {
      return tx.table('config').toCollection().modify(config => {
        if (!config.motoristaNome) config.motoristaNome = '';
      });
    });

    // Populando valores padrão na primeira vez que o banco é criado
    this.on('populate', () => {
      this.config.add({
        id: 1,
        valorPrimeiraViagem: 56.34,
        valorSegundaViagem: 14.98,
        motoristaNome: ''
      });
    });
  }

  // Métodos básicos de inserção e consulta
  async getConfig(): Promise<Config> {
    const config = await this.config.get(1);
    if (!config) {
      return { id: 1, valorPrimeiraViagem: 56.34, valorSegundaViagem: 14.98 };
    }
    return config;
  }

  async updateConfig(primeira: number, segunda: number, nome?: string): Promise<void> {
    const current = await this.getConfig();
    await this.config.put({
      id: 1,
      valorPrimeiraViagem: primeira,
      valorSegundaViagem: segunda,
      motoristaNome: nome !== undefined ? nome : current.motoristaNome
    });
  }

  async addViagem(destino: 'Cássia' | 'Passos', data: Date): Promise<number> {
    const config = await this.getConfig();
    
    // Verifica quantas viagens já foram feitas hoje para definir o valor
    const startOfDay = new Date(data);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(data);
    endOfDay.setHours(23, 59, 59, 999);

    const viagensHoje = await this.viagens
      .where('data_completa')
      .between(startOfDay.toISOString(), endOfDay.toISOString())
      .toArray();

    // Regra de negócio: 1ª viagem = valor 1, 2ª viagem = valor 2, 3ª ou mais = R$ 0,00
    let valor = 0;
    if (viagensHoje.length === 0) {
      valor = config.valorPrimeiraViagem;
    } else if (viagensHoje.length === 1) {
      valor = config.valorSegundaViagem;
    } else {
      valor = 0;
    }

    const id = await this.viagens.add({
      destino,
      data_completa: data.toISOString(),
      valor_ganho: valor
    });

    return id;
  }

  async getViagens(): Promise<Viagem[]> {
    return await this.viagens.orderBy('data_completa').reverse().toArray();
  }

  async deleteViagem(id: number): Promise<void> {
    await this.viagens.delete(id);
  }
}

export const db = new DatabaseHelper();
