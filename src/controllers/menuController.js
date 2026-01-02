// controllers/menuController.js
const { sequelize } = require('../models');

class MenuController {
  // ==================== MENÚ PÚBLICO ====================
  static async getPublicMenu(req, res) {
    const t = await sequelize.transaction();

    try {
      /**
       * NOTAS:
       * - Traemos IDs y campos necesarios para que el frontend pueda filtrar por product_id.
       * - Tomamos el "precio actual" por variante usando DISTINCT ON (la última vigencia válida).
       * - Devolvemos en el mismo shape: productos, variantes, sabores.
       *
       * Ajusta el nombre de la tabla de precios si NO es "variant_price".
       * (En tu árbol vi "variant_price", pero si tu modelo usa "prices", revisa el nombre real.)
       */
      const sql = `
        WITH current_price AS (
          SELECT DISTINCT ON (vp.variant_id)
            vp.variant_id,
            vp.price
          FROM naxos.variant_price vp
          WHERE vp.valid_from <= NOW()
            AND (vp.valid_to IS NULL OR vp.valid_to > NOW())
          ORDER BY vp.variant_id, vp.valid_from DESC
        )
        SELECT
          pc.name                 AS categoria,

          p.product_id            AS product_id,
          p.name                  AS product_name,
          p.description           AS descripcion_producto,
          p.image_url             AS product_image_url,

          f.flavor_id             AS flavor_id,
          f.name                  AS sabor,

          pv.variant_id           AS variant_id,
          pv.variant_name         AS tamano,
          pv.ounces               AS onzas,
          pv.toppings             AS toppings,
          pv.image_url            AS variant_image_url,

          cp.price                AS precio
        FROM naxos.product_flavor pf
        JOIN naxos.product p
          ON p.product_id = pf.product_id
        JOIN naxos.product_category pc
          ON pc.category_id = p.category_id
        JOIN naxos.flavor f
          ON f.flavor_id = pf.flavor_id
        JOIN naxos.product_variant pv
          ON pv.product_id = pf.product_id
        LEFT JOIN current_price cp
          ON cp.variant_id = pv.variant_id
        WHERE pf.is_active = true
          AND p.is_active = true
          AND pv.is_active = true
        ORDER BY
          pc.name ASC,
          p.name ASC,
          f.name ASC,
          pv.ounces ASC,
          pv.variant_name ASC
      `;

      const rows = await sequelize.query(sql, {
        type: sequelize.QueryTypes.SELECT,
        transaction: t,
      });

      // ------------- FORMATEO AL SHAPE QUE YA ESPERA TU FRONT -------------

      // productos (únicos por product_id)
      const productMap = new Map();
      // variantes (únicos por variant_id)
      const variantMap = new Map();
      // sabores agrupados por product_id
      const flavorsMap = new Map();

      for (const r of rows) {
        // Productos
        if (!productMap.has(r.product_id)) {
          productMap.set(r.product_id, {
            product_id: r.product_id,
            categoria: r.categoria || null,
            name: r.product_name,
            description: r.descripcion_producto,
            image_url: r.product_image_url,
          });
        }

        // Variantes
        if (!variantMap.has(r.variant_id)) {
          variantMap.set(r.variant_id, {
            product_id: r.product_id,
            variant_id: r.variant_id,
            variant_name: r.tamano,
            ounces: r.onzas,
            toppings: r.toppings || 0,
            foto_url: r.variant_image_url || r.product_image_url || null,
            precio_actual: r.precio !== null && r.precio !== undefined ? parseFloat(r.precio) : null,
          });
        }

        // Sabores por producto
        if (!flavorsMap.has(r.product_id)) flavorsMap.set(r.product_id, new Set());
        if (r.sabor) flavorsMap.get(r.product_id).add(r.sabor);
      }

      const formattedProducts = Array.from(productMap.values());

      const formattedVariants = Array.from(variantMap.values()).sort((a, b) => {
        // orden similar al que ya venías usando
        if (a.product_id !== b.product_id) return a.product_id - b.product_id;
        if ((a.ounces || 0) !== (b.ounces || 0)) return (a.ounces || 0) - (b.ounces || 0);
        return (a.variant_name || '').localeCompare(b.variant_name || '', 'es', { sensitivity: 'base' });
      });

      const formattedFlavors = Array.from(flavorsMap.entries()).map(([product_id, setSabores]) => ({
        product_id: parseInt(product_id, 10),
        sabores_activos: Array.from(setSabores).sort((a, b) =>
          a.localeCompare(b, 'es', { sensitivity: 'base' })
        ),
      }));

      await t.commit();

      return res.status(200).json({
        message: 'Carta obtenida exitosamente',
        menu: {
          productos: formattedProducts,
          variantes: formattedVariants,
          sabores: formattedFlavors,
        },
      });
    } catch (error) {
      await t.rollback();
      console.error('Error obteniendo carta:', error);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener la carta',
      });
    }
  }

  // (Los otros métodos se quedan igual por ahora)
}

module.exports = MenuController;
